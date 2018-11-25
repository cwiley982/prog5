/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const INPUT_SNAKE_URL = "https://cwiley982.github.io/prog5/sections.json"; // snake file
const INPUT_BORDER_URL = "https://cwiley982.github.io/prog5/border.json";
var Eye = vec3.fromValues(0,0,-5); // default eye position in world space
var Center = vec3.fromValues(0,0,0); // default view direction in world space
var Up = vec3.fromValues(0,1,0); // default view up vector
var LEFT_EDGE = -1, RIGHT_EDGE = 1, TOP = 1, BOTTOM = 1;
/* webgl and geometry data */
var gl = null; // the all powerful gl object. It's all here folks!
var snake = []; // the triangle data as loaded from input files
var numTriangleSets = 0; // how many triangle sets in input scene
var inputEllipsoids = []; // the ellipsoid data as loaded from input files
var numEllipsoids = 0; // how many ellipsoids in the input scene
var vertexBuffers = []; // this contains vertex coordinate lists by set, in triples
var triSetSizes = []; // this contains the size of each triangle set
var triangleBuffers = []; // lists of indices into vertexBuffers by set, in triples

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
        case "KeyA": // turn left
            break;
        case "KeyD": // tturn right
			break;
        case "KeyS": // turn down
            break;
        case "KeyW": // turn up
			break;
    } // end switch
} // end handleKeyDown

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
function loadModels() {
    
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
            numTriangleSets = snake.length; // remember how many tri sets
            for (var whichSet=0; whichSet<numTriangleSets; whichSet++) { // for each tri set

                // set up the vertex array
                snake[whichSet].glVertices = []; // flat coord list for webgl
                var numVerts = snake[whichSet].vertices.length; // num vertices in tri set
                for (whichSetVert=0; whichSetVert<numVerts; whichSetVert++) { // verts in set
                    vtxToAdd = snake[whichSet].vertices[whichSetVert]; // get vertex to add
                    snake[whichSet].glVertices.push(Math.abs(1 - vtxToAdd[0]),vtxToAdd[1],vtxToAdd[2]); // put coords in set coord list
                } // end for vertices in set

                // send the vertex coords to webGL
                vertexBuffers[whichSet] = gl.createBuffer(); // init empty webgl set vertex coord buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(snake[whichSet].glVertices),gl.STATIC_DRAW); // data in

                // set up the triangle index array, adjusting indices across sets
                snake[whichSet].glTriangles = []; // flat index list for webgl
                triSetSizes[whichSet] = snake[whichSet].triangles.length; // number of tris in this set
                for (whichSetTri=0; whichSetTri<triSetSizes[whichSet]; whichSetTri++) {
                    triToAdd = snake[whichSet].triangles[whichSetTri]; // get tri to add
                    snake[whichSet].glTriangles.push(triToAdd[0],triToAdd[1],triToAdd[2]); // put indices in set list
                } // end for triangles in set

                // send the triangle indices to webGL
                triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(snake[whichSet].glTriangles),gl.STATIC_DRAW); // data in
 
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

var fps = 2;
var b = 0;

// render the loaded model
function renderModels() {
	
	setTimeout(function() {
		gl.viewport(0,0,gl.canvas.width,gl.canvas.height);
		window.requestAnimationFrame(renderModels); // set up frame render callback
		
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
		
		// render each triangle set
		var currSet; // the tri set and its properties
		for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) {
			currSet = snake[whichTriSet];
			b += 15;
			
			gl.uniform3fv(colorULoc,vec3.clone(currSet.diffuse)); // pass in the diffuse reflectivity

			// vertex buffer: activate and feed into vertex shader
			gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichTriSet]); // activate
			gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed
			
			// triangle buffer: activate and render
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[whichTriSet]); // activate
			gl.drawElements(gl.TRIANGLES,3*triSetSizes[whichTriSet],gl.UNSIGNED_SHORT,0); // render
			
		} // end for each triangle set
	}, 1000 / fps);
} // end render model


/* MAIN -- HERE is where execution begins after window load */

function main() {
  
  setupWebGL(); // set up the webGL environment
  loadModels(); // load in the models from tri file
  setupShaders(); // setup the webGL shaders
  renderModels(); // draw the triangles using webGL
  
} // end main