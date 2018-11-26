/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const INPUT_SNAKE_URL = "https://cwiley982.github.io/prog5/snake.json"; // snake file
const INPUT_BORDER_URL = "https://cwiley982.github.io/prog5/border.json";
const SNAKE_COLOR = vec3.clone([0.24,0.47,0.85]);
const BORDER_COLOR = vec3.clone([0.5, 0.5, 0.5]);
var Eye = vec3.fromValues(0,0,-5); // default eye position in world space
var Center = vec3.fromValues(0,0,0); // default view direction in world space
var Up = vec3.fromValues(0,1,0); // default view up vector
var LEFT_EDGE = -0.9, RIGHT_EDGE = 0.9, TOP = 0.9, BOTTOM = -0.9;
/* webgl and geometry data */
var gl = null; // the all powerful gl object. It's all here folks!
var snake = []; // the triangle data as loaded from input files
var border = [];
var numSnakeTriangles = 0; // how many triangle sets in input scene
var numBorderTriangles = 0;
var inputEllipsoids = []; // the ellipsoid data as loaded from input files
var numEllipsoids = 0; // how many ellipsoids in the input scene
var snakeVertexBuffers = []; // this contains vertex coordinate lists by set, in triples
var snakeTriSetSizes = []; // this contains the size of each triangle set
var snakeTriangleBuffers = []; // lists of indices into snakeVertexBuffers by set, in triples
var borderVertexBuffers = [];
var borderTriangleBuffers = [];
var borderTriSetSizes = [];

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
    const dirEnum = {NEGATIVE: -1, POSITIVE: 1}; // enumerated rotation direction
    
    switch (event.code) {
        // view change
		case "ArrowLeft":
        case "KeyA": // turn left
			snake[0].direction = "LEFT";
            break;
		case "ArrowRight":
        case "KeyD": // turn right
			snake[0].direction = "RIGHT";
			break;
		case "ArrowDown":
        case "KeyS": // turn down
			snake[0].direction = "DOWN";
            break;
		case "ArrowUp":
        case "KeyW": // turn up
			snake[0].direction = "UP";
			break;
    } // end switch
} // end handleKeyDown

// move each section of the snake in the correct direction
function moveSnake() {
	for (var i = 0; i < snake.length; i++) {
		// move sections
		switch (snake[i].direction) {
			case "UP":
				for (var j = 0; j < 4; j++) {
					snake[i].glVertices[j * 3 + 1] += 0.1;
				}
				break;
			case "DOWN":
				for (var j = 0; j < 4; j++) {
					snake[i].glVertices[j * 3 + 1] -= 0.1;
				}
				break;
			case "LEFT":
				for (var j = 0; j < 4; j++) {
					snake[i].glVertices[j * 3] -= 0.1;
				}
				break;
			case "RIGHT":
				for (var j = 0; j < 4; j++) {
					snake[i].glVertices[j * 3] += 0.1;
				}
				break;
		}
		
		// send the vertex coords to webGL
		snakeVertexBuffers[i] = gl.createBuffer(); // init empty webgl set vertex coord buffer
		gl.bindBuffer(gl.ARRAY_BUFFER,snakeVertexBuffers[i]); // activate that buffer
		gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(snake[i].glVertices),gl.STATIC_DRAW); // data in
	}
	// update direction (from back of snake)
	for (var i = snake.length - 1; i > 0; i--) {
		if (snake[i-1].direction != snake[i].direction) {
			snake[i].direction = snake[i-1].direction;
		}
	}
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
            throw "Unable to load triangles file!";
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
} // end load models

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

// render the loaded model
function renderModels() {
	
	setTimeout(function() {
		gl.viewport(0,0,gl.canvas.width,gl.canvas.height);
		window.requestAnimationFrame(renderModels); // set up frame render callback
		
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
		
		// render each triangle set
		var currSet; // the tri set and its properties
		for (var whichTriSet=0; whichTriSet<numSnakeTriangles; whichTriSet++) {
			currSet = snake[whichTriSet];
			
			gl.uniform3fv(colorULoc,SNAKE_COLOR); // pass in the diffuse reflectivity

			// vertex buffer: activate and feed into vertex shader
			gl.bindBuffer(gl.ARRAY_BUFFER,snakeVertexBuffers[whichTriSet]); // activate
			gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed
			
			// triangle buffer: activate and render
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,snakeTriangleBuffers[whichTriSet]); // activate
			gl.drawElements(gl.TRIANGLES,3*snakeTriSetSizes[whichTriSet],gl.UNSIGNED_SHORT,0); // render
			
		} // end for each triangle set
		
		for (var whichTriSet=0; whichTriSet<numBorderTriangles; whichTriSet++) {
			currSet = border[whichTriSet];
			
			gl.uniform3fv(colorULoc,BORDER_COLOR); // pass in the diffuse reflectivity

			// vertex buffer: activate and feed into vertex shader
			gl.bindBuffer(gl.ARRAY_BUFFER,borderVertexBuffers[whichTriSet]); // activate
			gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed
			
			// triangle buffer: activate and render
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,borderTriangleBuffers[whichTriSet]); // activate
			gl.drawElements(gl.TRIANGLES,3*borderTriSetSizes[whichTriSet],gl.UNSIGNED_SHORT,0); // render
			
		} // end for each triangle set
		
		moveSnake();
	}, 1000 / fps);
} // end render model

/* MAIN -- HERE is where execution begins after window load */

function main() {
  
  setupWebGL(); // set up the webGL environment
  loadSnake(); // load in the models from tri file
  loadBorder();
  setupShaders(); // setup the webGL shaders
  renderModels(); // draw the triangles using webGL
  
} // end main