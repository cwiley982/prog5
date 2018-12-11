/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const INPUT_SNAKE_URL = "https://cwiley982.github.io/prog5/snake.json"; // snake file
const INPUT_BORDER_URL = "https://cwiley982.github.io/prog5/border.json";
const INPUT_FOOD_URL = "https://cwiley982.github.io/prog5/food.json";
var SNAKE_COLOR = vec3.clone([0.24,0.47,0.85]);
var BAD_SNAKE_COLOR = vec3.clone([1,0,0]);
const BORDER_COLOR = vec3.clone([0.5,0.5,0.5]);
const FOOD_COLOR = vec3.clone([0,1,0]);
var Eye = vec3.fromValues(0,0,-5); // default eye position in world space
var Center = vec3.fromValues(0,0,0); // default view direction in world space
var Up = vec3.fromValues(0,1,0); // default view up vector
var LEFT_EDGE = -0.95, RIGHT_EDGE = 0.95, TOP = 0.95, BOTTOM = -0.95;
var FOOD_LOC; // left, bottom, right, top
var move;
var moveComp;
var growSnake = false;
var growCompSnake = false;
/* webgl and geometry data */
var gl = null; // the all powerful gl object. It's all here folks!
var snake = []; // the triangle data as loaded from input files
var compSnake = [];
var border = [];
var food = [];
var numSnakeTriangles = 0; // how many triangle sets in input scene
var numBorderTriangles = 0;
var numCompSnakeTriangles = 0;
var inputEllipsoids = []; // the ellipsoid data as loaded from input files
var numEllipsoids = 0; // how many ellipsoids in the input scene
var snakeVertexBuffers = []; // this contains vertex coordinate lists by set, in triples
var snakeTriSetSizes = []; // this contains the size of each triangle set
var snakeTriangleBuffers = []; // lists of indices into snakeVertexBuffers by set, in triples
var borderVertexBuffers = [];
var borderTriangleBuffers = [];
var borderTriSetSizes = [];
var foodVertexBuffers = [];
var foodTriangleBuffer = [];
var foodTriSetSizes = [];
var compSnakeVertexBuffers = [];
var compSnakeTriangleBuffers = [];
var compSnakeTriSetSizes = [];

/* shader parameter locations */
var colorULoc;

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input json file

// does stuff when keys are pressed
function handleKeyDown(event) {
    const modelEnum = {TRIANGLES: "triangles", ELLIPSOID: "ellipsoid"}; // enumerated model type
    
    switch (event.code) {
        // view change
		case "ArrowLeft":
        case "KeyA": // turn left
			if (snake[0].direction != "RIGHT") {
				snake[0].direction = "LEFT";
			}
            break;
		case "ArrowRight":
        case "KeyD": // turn right
			if (snake[0].direction != "LEFT") {
				snake[0].direction = "RIGHT";
			}
			break;
		case "ArrowDown":
        case "KeyS": // turn down
			if (snake[0].direction != "UP") {
				snake[0].direction = "DOWN";
			}
            break;
		case "ArrowUp":
        case "KeyW": // turn up
			if (snake[0].direction != "DOWN") {
				snake[0].direction = "UP";
			}
			break;
    } // end switch
} // end handleKeyDown

function round(number) {
	return Math.round(number * 100) / 100;
}

// move each section of the snake in the correct direction
function moveSnake() {
	var verts = snake[0].glVertices;
	if (((round(verts[0]) == LEFT_EDGE && snake[0].direction == "LEFT")
		|| (round(verts[9]) == RIGHT_EDGE && snake[0].direction == "RIGHT")
		|| (round(verts[7]) == TOP && snake[0].direction == "UP")
		|| (round(verts[4]) == BOTTOM  && snake[0].direction == "DOWN")
		|| touchingSelf() || touchingCompSnake()) && move) {
		SNAKE_COLOR = vec3.clone([1,0,0]);
		move = false;
		setTimeout(function() {
			loadSnake();
		}, 1000);
	}
	if (move) {
		growSnake = touchingFood(verts);
		
		// for each section
		for (var i = 0; i < snake.length; i++) {
			// move section
			switch (snake[i].direction) {
				case "UP":
					for (var j = 0; j < 4; j++) {
						snake[i].glVertices[j * 3 + 1] += 0.05;
					}
					break;
				case "DOWN":
					for (var j = 0; j < 4; j++) {
						snake[i].glVertices[j * 3 + 1] -= 0.05;
					}
					break;
				case "LEFT":
					for (var j = 0; j < 4; j++) {
						snake[i].glVertices[j * 3] -= 0.05;
					}
					break;
				case "RIGHT":
					for (var j = 0; j < 4; j++) {
						snake[i].glVertices[j * 3] += 0.05;
					}
					break;
			}
			
			// send the vertex coords to webGL
			snakeVertexBuffers[i] = gl.createBuffer(); // init empty webgl set vertex coord buffer
			gl.bindBuffer(gl.ARRAY_BUFFER,snakeVertexBuffers[i]); // activate that buffer
			gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(snake[i].glVertices),gl.STATIC_DRAW); // data in
		}
		
		if (growSnake) {
			moveFood();
			growSnake = false;
			numSnakeTriangles += 1;
			//add to end of snake based on direction of last section
			snake.push({}); // add new section
			
			var length = snake.length;
			// copy over CURRENT vertices from section before new one
			snake[length - 1].glVertices = snake[length - 2].glVertices.slice();
			snakeTriSetSizes[length - 1] = 2;
			
			var direction = snake[length - 2].direction;
			switch (direction) { // update vertices here
				case "UP": // add below it
					for (var i = 0; i < 4; i++) {
						snake[length - 1].glVertices[i * 3 + 1] = snake[length - 1].glVertices[i * 3 + 1] - 0.05;
					}
					break;
				case "DOWN": // add above it
					for (var i = 0; i < 4; i++) {
						snake[length - 1].glVertices[i * 3 + 1] = snake[length - 1].glVertices[i * 3 + 1] + 0.05;
					}
					break;
				case "LEFT": // add to right of it
					for (var i = 0; i < 4; i++) {
						snake[length - 1].glVertices[i * 3] = snake[length - 1].glVertices[i * 3] + 0.05;
					}
					break;
				case "RIGHT": // add to left of it
					for (var i = 0; i < 4; i++) {
					snake[length - 1].glVertices[i * 3] = snake[length - 1].glVertices[i * 3] - 0.05;
					}
					break;
			}
			snake[length - 1].direction = direction;
			
			// send the vertex coords to webGL
			snakeVertexBuffers.push(gl.createBuffer()); // init empty webgl set vertex coord buffer
			gl.bindBuffer(gl.ARRAY_BUFFER,snakeVertexBuffers[length - 1]); // activate that buffer
			gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(snake[length - 1].glVertices),gl.STATIC_DRAW); // data in
		
			snake[length - 1].glTriangles = [0, 1, 3, 0, 2, 3];
			
			// send the vertex coords to webGL
			snakeTriangleBuffers.push(gl.createBuffer()); // init empty webgl set vertex coord buffer
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,snakeTriangleBuffers[length - 1]); // activate that buffer
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(snake[length - 1].glTriangles),gl.STATIC_DRAW); // data in
		}
	
		// update direction (from back of snake)
		for (var i = snake.length - 1; i > 0; i--) {
			if (snake[i-1].direction != snake[i].direction) {
				snake[i].direction = snake[i-1].direction;
			}
		}
	}
}

function growComputerSnake() {
	growCompSnake = false;
	numCompSnakeTriangles += 1;
	//add to end of snake based on direction of last section
	compSnake.push({}); // add new section
	
	var length = compSnake.length;
	// copy over CURRENT vertices from section before new one
	compSnake[length - 1].glVertices = compSnake[length - 2].glVertices.slice();
	compSnakeTriSetSizes[length - 1] = 2;
	
	var direction = compSnake[length - 2].direction;
	switch (direction) { // update vertices here
		case "UP": // add below it
			for (var i = 0; i < 4; i++) {
				compSnake[length - 1].glVertices[i * 3 + 1] = compSnake[length - 1].glVertices[i * 3 + 1] - 0.05;
			}
			break;
		case "DOWN": // add above it
			for (var i = 0; i < 4; i++) {
				compSnake[length - 1].glVertices[i * 3 + 1] = compSnake[length - 1].glVertices[i * 3 + 1] + 0.05;
			}
			break;
		case "LEFT": // add to right of it
			for (var i = 0; i < 4; i++) {
				compSnake[length - 1].glVertices[i * 3] = compSnake[length - 1].glVertices[i * 3] + 0.05;
			}
			break;
		case "RIGHT": // add to left of it
			for (var i = 0; i < 4; i++) {
			compSnake[length - 1].glVertices[i * 3] = compSnake[length - 1].glVertices[i * 3] - 0.05;
			}
			break;
	}
	compSnake[length - 1].direction = direction;
	
	// send the vertex coords to webGL
	compSnakeVertexBuffers.push(gl.createBuffer()); // init empty webgl set vertex coord buffer
	gl.bindBuffer(gl.ARRAY_BUFFER,compSnakeVertexBuffers[length - 1]); // activate that buffer
	gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(compSnake[length - 1].glVertices),gl.STATIC_DRAW); // data in

	compSnake[length - 1].glTriangles = [0, 1, 3, 0, 2, 3];
	
	// send the vertex coords to webGL
	compSnakeTriangleBuffers.push(gl.createBuffer()); // init empty webgl set vertex coord buffer
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,compSnakeTriangleBuffers[length - 1]); // activate that buffer
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(compSnake[length - 1].glTriangles),gl.STATIC_DRAW); // data in
}

function createCompSnake() {
	compSnake = [];
	BAD_SNAKE_COLOR = vec3.clone([1,0,0]);
	// create first section
	var xVal = Math.floor(Math.random() * 38);
	var yVal = Math.floor(Math.random() * 38);
	
	var left = (xVal * 0.05) - 0.95;
	var right = (left + 0.05);
	var bottom = (yVal * 0.05) - 0.95;
	var top = (bottom + 0.05);

	compSnake.push({});
	compSnake[0].glVertices = [];
	compSnake[0].glVertices.push(left, bottom,0); // new bottom left coord
	compSnake[0].glVertices.push(right,bottom,0); // new bottom right coord
	compSnake[0].glVertices.push(left,top,0); // new top left coord
	compSnake[0].glVertices.push(right,top,0); // new top right coord
	
	// send the vertex coords to webGL
	compSnakeVertexBuffers[0] = gl.createBuffer(); // init empty webgl set vertex coord buffer
	gl.bindBuffer(gl.ARRAY_BUFFER,compSnakeVertexBuffers[0]); // activate that buffer
	gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(compSnake[0].glVertices),gl.STATIC_DRAW); // data in
	
	compSnake[0].glTriangles = [0, 1, 3, 0, 2, 3];
	
	// send the vertex coords to webGL
	compSnakeTriangleBuffers[0] = gl.createBuffer(); // init empty webgl set vertex coord buffer
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,compSnakeTriangleBuffers[0]); // activate that buffer
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(compSnake[0].glTriangles),gl.STATIC_DRAW); // data in
	
	compSnake[0].direction = randomDirection(null);
	compSnakeTriSetSizes[0] = 2;
	numCompSnakeTriangles = 1;
	
	//make it 4 long to start
	growComputerSnake();
	growComputerSnake();
	growComputerSnake();
	
	moveComp = true;
}

function moveCompSnake() {
	var verts = compSnake[0].glVertices;
	if (((round(verts[0]) == LEFT_EDGE && compSnake[0].direction == "LEFT")
		|| (round(verts[9]) == RIGHT_EDGE && compSnake[0].direction == "RIGHT")
		|| (round(verts[7]) == TOP && compSnake[0].direction == "UP")
		|| (round(verts[4]) == BOTTOM  && compSnake[0].direction == "DOWN")
		|| touchingSelf() || touchingSnake()) && moveComp) {
		BAD_SNAKE_COLOR = vec3.clone([0.5,1,0.75]);
		moveComp = false;
		setTimeout(function() {
			createCompSnake();
		}, 1000);
	}
	if (moveComp) {
		growCompSnake = touchingFood(verts);
		// for each section
		for (var i = 0; i < compSnake.length; i++) {
			// move section
			switch (compSnake[i].direction) {
				case "UP":
					for (var j = 0; j < 4; j++) {
						compSnake[i].glVertices[j * 3 + 1] += 0.05;
					}
					break;
				case "DOWN":
					for (var j = 0; j < 4; j++) {
						compSnake[i].glVertices[j * 3 + 1] -= 0.05;
					}
					break;
				case "LEFT":
					for (var j = 0; j < 4; j++) {
						compSnake[i].glVertices[j * 3] -= 0.05;
					}
					break;
				case "RIGHT":
					for (var j = 0; j < 4; j++) {
						compSnake[i].glVertices[j * 3] += 0.05;
					}
					break;
			}
			
			// send the vertex coords to webGL
			compSnakeVertexBuffers[i] = gl.createBuffer(); // init empty webgl set vertex coord buffer
			gl.bindBuffer(gl.ARRAY_BUFFER,compSnakeVertexBuffers[i]); // activate that buffer
			gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(compSnake[i].glVertices),gl.STATIC_DRAW); // data in
		}
		
		if (growCompSnake) {
			moveFood();
			growComputerSnake();
		}
	
		// update direction (from back of snake)
		for (var i = compSnake.length - 1; i > 0; i--) {
			if (compSnake[i-1].direction != compSnake[i].direction) {
				compSnake[i].direction = compSnake[i-1].direction;
			}
		}
	}
}

// UNUSED
function turnIfNearEdge() {
	var verts = compSnake[0].glVertices;
	switch (compSnake[0].direction) {
		case "UP":
			if (round(verts[3 * 2 + 1]) == TOP) {
				compSnake[0].direction = Math.floor(Math.random() * 2) == 0 ? "RIGHT" : "LEFT";
				turnIfNearEdge();
			}
			break;
		case "DOWN":
			if (round(verts[3 * 0 + 1]) == BOTTOM) {
				compSnake[0].direction = Math.floor(Math.random() * 2) == 0 ? "RIGHT" : "LEFT";
				turnIfNearEdge();
			}
			break;
		case "LEFT":
			if (round(verts[3 * 2 + 0]) == LEFT_EDGE) {
				compSnake[0].direction = Math.floor(Math.random() * 2) == 0 ? "UP" : "DOWN";
				turnIfNearEdge();
			}
			break;
		case "RIGHT":
			if (round(verts[3 * 1 + 0]) == RIGHT_EDGE) {
				compSnake[0].direction = Math.floor(Math.random() * 2) == 0 ? "UP" : "DOWN";
				turnIfNearEdge();
			}
			break;
	}
}

function randomDirection(oldDirection) {
	var random = Math.floor(Math.random() * 4);
	switch (random) {
		case 0:
			if (!oldDirection || oldDirection != "RIGHT") {
				return "LEFT";
			} else {
				return randomDirection(oldDirection);
			}
		case 1:
			if (!oldDirection || oldDirection != "UP") {
				return "DOWN";
			} else {
				return randomDirection(oldDirection);
			}
		case 2:
			if (!oldDirection || oldDirection != "LEFT") {
				return "RIGHT";
			} else {
				return randomDirection(oldDirection);
			}
		case 3:
			if (!oldDirection || oldDirection != "DOWN") {
				return "UP";
			} else {
				return randomDirection(oldDirection);
			}
	}
}

function touchingSelf() {
	switch (snake[0].direction) {
		case "UP":
			// check verts 3 and 4 (2 & 3) of snake[0] against 1 and 2 (0 & 1) of rest of snake
			var xLeft = round(snake[0].glVertices[6]);
			var xRight = round(snake[0].glVertices[9]);
			var y = round(snake[0].glVertices[10]);
			for (var i = 1; i < snake.length; i++) {
				if (round(snake[i].glVertices[0]) == xLeft && round(snake[i].glVertices[3]) == xRight && round(snake[i].glVertices[4]) == y) {
					return true;
				}
			}
			break;
		case "DOWN":
			// check verts 1 and 2 (0 & 1) of snake[0] against 3 and 4 (2 & 3) of rest of snake
			var xLeft = round(snake[0].glVertices[0]);
			var xRight = round(snake[0].glVertices[3]);
			var y = round(snake[0].glVertices[4]);
			for (var i = 1; i < snake.length; i++) {
				if (round(snake[i].glVertices[6]) == xLeft && round(snake[i].glVertices[9]) == xRight && round(snake[i].glVertices[10]) == y) {
					return true;
				}
			}
			break;
		case "LEFT":
			// check verts 1 and 3 (0 & 2) of snake[0] against 2 and 4 (1 & 3) of rest of snake
			var yBottom = round(snake[0].glVertices[1]);
			var yTop = round(snake[0].glVertices[7]);
			var x = round(snake[0].glVertices[6]);
			for (var i = 1; i < snake.length; i++) {
				if (round(snake[i].glVertices[4]) == yBottom && round(snake[i].glVertices[10]) == yTop && round(snake[i].glVertices[9]) == x) {
					return true;
				}
			}
			break;
		case "RIGHT":
			// check verts 2 and 4 (1 & 3) of snake[0] against 1 and 3 (0 & 2) of rest of snake
			var yBottom = round(snake[0].glVertices[4]);
			var yTop = round(snake[0].glVertices[10]);
			var x = round(snake[0].glVertices[9]);
			for (var i = 1; i < snake.length; i++) {
				if (round(snake[i].glVertices[1]) == yBottom && round(snake[i].glVertices[7]) == yTop && round(snake[i].glVertices[6]) == x) {
					return true;
				}
			}
			break;
	}
	return false;
}

function touchingSnake() {
	switch (compSnake[0].direction) {
		case "UP":
			// check verts 3 and 4 (2 & 3) of snake[0] against 1 and 2 (0 & 1) of rest of snake
			var xLeft = round(compSnake[0].glVertices[6]);
			var xRight = round(compSnake[0].glVertices[9]);
			var y = round(compSnake[0].glVertices[10]);
			for (var i = 1; i < snake.length; i++) {
				if (round(snake[i].glVertices[0]) == xLeft && round(snake[i].glVertices[3]) == xRight && round(snake[i].glVertices[4]) == y) {
					return true;
				}
			}
			break;
		case "DOWN":
			// check verts 1 and 2 (0 & 1) of snake[0] against 3 and 4 (2 & 3) of rest of snake
			var xLeft = round(compSnake[0].glVertices[0]);
			var xRight = round(compSnake[0].glVertices[3]);
			var y = round(compSnake[0].glVertices[4]);
			for (var i = 1; i < snake.length; i++) {
				if (round(snake[i].glVertices[6]) == xLeft && round(snake[i].glVertices[9]) == xRight && round(snake[i].glVertices[10]) == y) {
					return true;
				}
			}
			break;
		case "LEFT":
			// check verts 1 and 3 (0 & 2) of snake[0] against 2 and 4 (1 & 3) of rest of snake
			var yBottom = round(compSnake[0].glVertices[1]);
			var yTop = round(compSnake[0].glVertices[7]);
			var x = round(compSnake[0].glVertices[6]);
			for (var i = 1; i < snake.length; i++) {
				if (round(snake[i].glVertices[4]) == yBottom && round(snake[i].glVertices[10]) == yTop && round(snake[i].glVertices[9]) == x) {
					return true;
				}
			}
			break;
		case "RIGHT":
			// check verts 2 and 4 (1 & 3) of snake[0] against 1 and 3 (0 & 2) of rest of snake
			var yBottom = round(compSnake[0].glVertices[4]);
			var yTop = round(compSnake[0].glVertices[10]);
			var x = round(compSnake[0].glVertices[9]);
			for (var i = 1; i < snake.length; i++) {
				if (round(snake[i].glVertices[1]) == yBottom && round(snake[i].glVertices[7]) == yTop && round(snake[i].glVertices[6]) == x) {
					return true;
				}
			}
			break;
	}
	return false;
}

function touchingCompSnake() {
	switch (snake[0].direction) {
		case "UP":
			// check verts 3 and 4 (2 & 3) of snake[0] against 1 and 2 (0 & 1) of rest of snake
			var xLeft = round(snake[0].glVertices[6]);
			var xRight = round(snake[0].glVertices[9]);
			var y = round(snake[0].glVertices[10]);
			for (var i = 1; i < compSnake.length; i++) {
				if (round(compSnake[i].glVertices[0]) == xLeft && round(compSnake[i].glVertices[3]) == xRight && round(compSnake[i].glVertices[4]) == y) {
					return true;
				}
			}
			break;
		case "DOWN":
			// check verts 1 and 2 (0 & 1) of snake[0] against 3 and 4 (2 & 3) of rest of snake
			var xLeft = round(snake[0].glVertices[0]);
			var xRight = round(snake[0].glVertices[3]);
			var y = round(snake[0].glVertices[4]);
			for (var i = 1; i < compSnake.length; i++) {
				if (round(compSnake[i].glVertices[6]) == xLeft && round(compSnake[i].glVertices[9]) == xRight && round(compSnake[i].glVertices[10]) == y) {
					return true;
				}
			}
			break;
		case "LEFT":
			// check verts 1 and 3 (0 & 2) of snake[0] against 2 and 4 (1 & 3) of rest of snake
			var yBottom = round(snake[0].glVertices[1]);
			var yTop = round(snake[0].glVertices[7]);
			var x = round(snake[0].glVertices[6]);
			for (var i = 1; i < compSnake.length; i++) {
				if (round(compSnake[i].glVertices[4]) == yBottom && round(compSnake[i].glVertices[10]) == yTop && round(compSnake[i].glVertices[9]) == x) {
					return true;
				}
			}
			break;
		case "RIGHT":
			// check verts 2 and 4 (1 & 3) of snake[0] against 1 and 3 (0 & 2) of rest of snake
			var yBottom = round(snake[0].glVertices[4]);
			var yTop = round(snake[0].glVertices[10]);
			var x = round(snake[0].glVertices[9]);
			for (var i = 1; i < compSnake.length; i++) {
				if (round(compSnake[i].glVertices[1]) == yBottom && round(compSnake[i].glVertices[7]) == yTop && round(compSnake[i].glVertices[6]) == x) {
					return true;
				}
			}
			break;
	}
	return false;
}

function touchingFood(verts) {
	// check for food
	switch (snake[0].direction) {
		case "UP":
			if (round(verts[7]) == round(FOOD_LOC[1]) && round(verts[0]) == round(FOOD_LOC[0])) {
				return true;
			}
			break;
		case "DOWN":
			if (round(verts[7]) == round(FOOD_LOC[3]) && round(verts[0]) == round(FOOD_LOC[0])) {
				return true;
			}
			break;
		case "LEFT":
			if (round(verts[0]) == round(FOOD_LOC[0]) && round(verts[4]) == round(FOOD_LOC[1])) {
				return true;
			}
			break;
		case "RIGHT":
			if (round(verts[0]) == round(FOOD_LOC[2]) && round(verts[1]) == round(FOOD_LOC[1])) {
				return true;
			}
			break;
	}
	return false;
}

function moveFood() {
	var xVal = Math.floor(Math.random() * 38);
	var yVal = Math.floor(Math.random() * 38);
	
	var left = (xVal * 0.05) - 0.95;
	var right = (left + 0.05);
	var bottom = (yVal * 0.05) - 0.95;
	var top = (bottom + 0.05);
	
	FOOD_LOC = [left, bottom, right, top];
	food.glVertices = [];
	food.glVertices.push(left, bottom,0); // new bottom left coord
	food.glVertices.push(right,bottom,0); // new bottom right coord
	food.glVertices.push(left,top,0); // new top left coord
	food.glVertices.push(right,top,0); // new top right coord
	
	// send the vertex coords to webGL
	foodVertexBuffer = gl.createBuffer(); // init empty webgl set vertex coord buffer
	gl.bindBuffer(gl.ARRAY_BUFFER,foodVertexBuffer); // activate that buffer
	gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(food.glVertices),gl.STATIC_DRAW); // data in
	
	food.glTriangles = [0, 1, 3, 0, 2, 3];
	
	// send the vertex coords to webGL
	foodTriangleBuffer = gl.createBuffer(); // init empty webgl set vertex coord buffer
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,foodTriangleBuffer); // activate that buffer
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(food.glTriangles),gl.STATIC_DRAW); // data in
}

// set up the webGL environment
function setupWebGL() {
    
    // Set up keys
    document.onkeydown = handleKeyDown; // call this when key pressed
	 
	// create a webgl canvas and set it up
	var webGLCanvas = document.getElementById("myWebGLCanvas"); // create a webgl canvas
	gl = webGLCanvas.getContext("webgl"); // get a webgl object from it
	try {
		if (gl == null) {
			throw "unable to create gl context -- is your browser gl ready?";
		} else {
			gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
			gl.clearDepth(1.0); // use max when we clear the depth buffer
			gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
		}
	} catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

// read models in, load them into webgl buffers
function loadSnake() {
    
    snake = getJSONFile(INPUT_SNAKE_URL,"snake"); // read in the triangle data
	
    try {
        if (snake == String.null)
            throw "Unable to load triangles file!";
        else {
            var whichSetVert; // index of vertex in current triangle set
            var whichSetTri; // index of triangle in current triangle set
            var vtxToAdd; // vtx coords to add to the coord array
            var triToAdd; // tri indices to add to the index array
            // process each triangle set to load webgl vertex and triangle buffers
            numSnakeTriangles = snake.length; // remember how many tri sets
            for (var whichSet=0; whichSet<numSnakeTriangles; whichSet++) { // for each tri set

                // set up the vertex array
                snake[whichSet].glVertices = []; // flat coord list for webgl
                var numVerts = snake[whichSet].vertices.length; // num vertices in tri set
                for (whichSetVert=0; whichSetVert<numVerts; whichSetVert++) { // verts in set
                    vtxToAdd = snake[whichSet].vertices[whichSetVert]; // get vertex to add
                    snake[whichSet].glVertices.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]); // put coords in set coord list
                } // end for vertices in set

                // send the vertex coords to webGL
                snakeVertexBuffers[whichSet] = gl.createBuffer(); // init empty webgl set vertex coord buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,snakeVertexBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(snake[whichSet].glVertices),gl.STATIC_DRAW); // data in

                // set up the triangle index array, adjusting indices across sets
                snake[whichSet].glTriangles = []; // flat index list for webgl
                snakeTriSetSizes[whichSet] = snake[whichSet].triangles.length; // number of tris in this set
                for (whichSetTri=0; whichSetTri<snakeTriSetSizes[whichSet]; whichSetTri++) {
                    triToAdd = snake[whichSet].triangles[whichSetTri]; // get tri to add
                    snake[whichSet].glTriangles.push(triToAdd[0],triToAdd[1],triToAdd[2]); // put indices in set list
                } // end for triangles in set

                // send the triangle indices to webGL
                snakeTriangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, snakeTriangleBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(snake[whichSet].glTriangles),gl.STATIC_DRAW); // data in
 
            } // end for each triangle set
			
			SNAKE_COLOR = vec3.clone([0.24,0.47,0.85]);
			move = true;
			moveFood();
		} // end if file loaded
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end load models

// read models in, load them into webgl buffers
function loadBorder() {
    
    border = getJSONFile(INPUT_BORDER_URL, "border"); // read in the triangle data
	
    try {
        if (border == String.null)
            throw "Unable to load border file!";
        else {
            var whichSetVert; // index of vertex in current triangle set
            var whichSetTri; // index of triangle in current triangle set
            var vtxToAdd; // vtx coords to add to the coord array
            var triToAdd; // tri indices to add to the index array
            // process each triangle set to load webgl vertex and triangle buffers
            numBorderTriangles = border.length; // remember how many tri sets
            for (var whichSet=0; whichSet<numBorderTriangles; whichSet++) { // for each tri set

                // set up the vertex array
                border[whichSet].glVertices = []; // flat coord list for webgl
                var numVerts = border[whichSet].vertices.length; // num vertices in tri set
                for (whichSetVert=0; whichSetVert<numVerts; whichSetVert++) { // verts in set
                    vtxToAdd = border[whichSet].vertices[whichSetVert]; // get vertex to add
                    border[whichSet].glVertices.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]); // put coords in set coord list
                } // end for vertices in set

                // send the vertex coords to webGL
                borderVertexBuffers[whichSet] = gl.createBuffer(); // init empty webgl set vertex coord buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,borderVertexBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(border[whichSet].glVertices),gl.STATIC_DRAW); // data in

                // set up the triangle index array, adjusting indices across sets
                border[whichSet].glTriangles = []; // flat index list for webgl
                borderTriSetSizes[whichSet] = border[whichSet].triangles.length; // number of tris in this set
                for (whichSetTri=0; whichSetTri<borderTriSetSizes[whichSet]; whichSetTri++) {
                    triToAdd = border[whichSet].triangles[whichSetTri]; // get tri to add
                    border[whichSet].glTriangles.push(triToAdd[0],triToAdd[1],triToAdd[2]); // put indices in set list
                } // end for triangles in set

                // send the triangle indices to webGL
                borderTriangleBuffers[whichSet] = gl.createBuffer(); // init empty triangle index buffer
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, borderTriangleBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(border[whichSet].glTriangles),gl.STATIC_DRAW); // data in
             } // end for each triangle set
		} // end if file loaded
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end load border

// setup the webGL shaders
function setupShaders() {
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 aVertexPosition; // vertex position
		
        void main(void) {
            gl_Position = vec4(aVertexPosition, 1.0);
        }
    `;
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
		precision mediump float;
        uniform vec3 uColor; // the diffuse reflectivity
            
        void main(void) {
            gl_FragColor = vec4(uColor, 1.0); 
        }
    `;
    
    try {
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                
                // locate and enable vertex attributes
                vPosAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexPosition"); // ptr to vertex pos attrib
                gl.enableVertexAttribArray(vPosAttribLoc); // connect attrib to array
				
                colorULoc = gl.getUniformLocation(shaderProgram, "uColor"); // ptr to diffuse
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders

var fps = 8;
var count = 0;

// render the loaded model
function renderModels() {
	
	setTimeout(function() {
		gl.viewport(0,0,gl.canvas.width,gl.canvas.height);
		window.requestAnimationFrame(renderModels); // set up frame render callback
		
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
		
		// render each triangle set
		for (var whichTriSet=0; whichTriSet<numSnakeTriangles; whichTriSet++) {
			gl.uniform3fv(colorULoc,SNAKE_COLOR); // pass in the diffuse reflectivity

			// vertex buffer: activate and feed into vertex shader
			gl.bindBuffer(gl.ARRAY_BUFFER,snakeVertexBuffers[whichTriSet]); // activate
			gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed
			
			// triangle buffer: activate and render
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,snakeTriangleBuffers[whichTriSet]); // activate
			gl.drawElements(gl.TRIANGLES,3*snakeTriSetSizes[whichTriSet],gl.UNSIGNED_SHORT,0); // render
			
		} // end for each triangle set
		
		// render each triangle set
		for (var whichTriSet=0; whichTriSet<numCompSnakeTriangles; whichTriSet++) {
			gl.uniform3fv(colorULoc,BAD_SNAKE_COLOR); // pass in the diffuse reflectivity

			// vertex buffer: activate and feed into vertex shader
			gl.bindBuffer(gl.ARRAY_BUFFER,compSnakeVertexBuffers[whichTriSet]); // activate
			gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed
			
			// triangle buffer: activate and render
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,compSnakeTriangleBuffers[whichTriSet]); // activate
			gl.drawElements(gl.TRIANGLES,3*compSnakeTriSetSizes[whichTriSet],gl.UNSIGNED_SHORT,0); // render
		} // end for each triangle set
		
		for (var whichTriSet=0; whichTriSet<numBorderTriangles; whichTriSet++) {
			gl.uniform3fv(colorULoc,BORDER_COLOR); // pass in the diffuse reflectivity

			// vertex buffer: activate and feed into vertex shader
			gl.bindBuffer(gl.ARRAY_BUFFER,borderVertexBuffers[whichTriSet]); // activate
			gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed
			
			// triangle buffer: activate and render
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,borderTriangleBuffers[whichTriSet]); // activate
			gl.drawElements(gl.TRIANGLES,3*borderTriSetSizes[whichTriSet],gl.UNSIGNED_SHORT,0); // render
			
		} // end for each triangle set
		
		// render food pixel
		gl.uniform3fv(colorULoc,FOOD_COLOR);
		
		// vertex buffer: activate and feed into vertex shader
		gl.bindBuffer(gl.ARRAY_BUFFER,foodVertexBuffer); // activate
		gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed
		
		// triangle buffer: activate and render
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,foodTriangleBuffer); // activate
		gl.drawElements(gl.TRIANGLES,3*2,gl.UNSIGNED_SHORT,0); // render
		
		moveSnake();
		moveCompSnake();
		if (count % 10 == 0) {
			compSnake[0].direction = randomDirection(compSnake[0].direction);
		}
		count += 1;
	}, 1000 / fps);
} // end render model

/* MAIN -- HERE is where execution begins after window load */

function main() {
	setupWebGL(); // set up the webGL environment
	loadSnake(); // load in the models from tri file
	loadBorder();
	createCompSnake();
	setupShaders(); // setup the webGL shaders
	renderModels(); // draw the triangles using webGL
} // end main