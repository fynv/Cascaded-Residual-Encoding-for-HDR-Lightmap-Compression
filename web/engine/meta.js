import { Bone, Skeleton, SkinnedMesh, CustomBlending, OneFactor, HalfFloatType, WebGLRenderTarget, WebGLRenderer, LinearEncoding, sRGBEncoding, Color, Scene, Clock, OrthographicCamera, PerspectiveCamera, Fog, Light, DirectionalLight, PointLight, SpotLight, AmbientLight, HemisphereLight, LightProbe, Group, Object3D, BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, VideoTexture, PlaneBufferGeometry, BoxBufferGeometry, SphereBufferGeometry, MeshStandardMaterial, Mesh, Texture, TextureLoader, CubeTextureLoader, AnimationMixer, Vector3, Matrix4, Quaternion, Raycaster, PCFSoftShadowMap, CameraHelper } from "./vendor/three/build/three.module.js"
import { PointerLockControls } from './vendor/three/examples/jsm/controls/PointerLockControls.js';
import { OrbitControls } from './vendor/three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from './vendor/three/examples/jsm/loaders/GLTFLoader.js'
import { RGBELoader } from './vendor/three/examples/jsm/loaders/RGBELoader.js';
import { HDRCubeTextureLoader } from './vendor/three/examples/jsm/loaders/HDRCubeTextureLoader.js'
import { DRACOLoader } from './vendor/three/examples/jsm/loaders/DRACOLoader.js'
import { DDSLoader } from './vendor/three/examples/jsm/loaders/DDSLoader.js'
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from './vendor/three-mesh-bvh/build/index.module.js';

BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
Mesh.prototype.raycast = acceleratedRaycast;


const getAbsoluteUrl = (function () {
    let a;

    return function (url) {
        if (!a) a = document.createElement('a');
        a.href = url;

        return a.href;
    };
})();

function get_url_extension(url) {
    return url.split(/[#?]/)[0].split('.').pop().trim();
}

function string_to_boolean(string) {
    switch (string.toLowerCase().trim()) {
        case "true":
        case "yes":
        case "1":
            return true;

        case "false":
        case "no":
        case "0":
        case null:
            return false;

        default:
            return Boolean(string);
    }
}

function removeObject3D(object) {
    if (!(object instanceof Object3D)) return false;

    if (object.geometry) {
        object.geometry.dispose();
    }

    if (object.material) {
        if (object.material instanceof Array) {
            object.material.forEach(material => material.dispose());
        }
        else {
            object.material.dispose();
        }
    }

    if (object.parent) {
        object.parent.remove(object);
    }

    return true;
}

class JoyStick {
    constructor(options) {
        const circleOut = document.createElement("div")
        circleOut.style.cssText = "position:absolute; bottom:35px; left:50%; transform:translateX(-50%) translateY(40px); border-radius:50%; padding:80px";
        const circle = document.createElement("div");
        circle.style.cssText = "position:relative; width:80px; height:80px; background:rgba(126, 126, 126, 0.5); border:#444 solid medium; border-radius:50%;";
        const thumb = document.createElement("div");
        thumb.style.cssText = "position: absolute; left: 20px; top: 20px; width: 40px; height: 40px; border-radius: 50%; background: #fff;";
        circleOut.appendChild(circle)
        circle.appendChild(thumb);
        document.body.appendChild(circleOut);
        
        this.domElement = thumb;
        this.domCircle = circleOut
        this.maxRadius = options.maxRadius || 40;
        this.maxRadiusSquared = this.maxRadius * this.maxRadius;
        this.onMove = options.onMove;
        this.doc = options.doc;
        
        const move = (evt) => {
            
            evt = evt || window.event;
            const mouse = this.getMousePosition(evt);
            let delta_x = mouse.x - this.offset.x;
            let delta_y = mouse.y - this.offset.y;
            
            const run_status = Math.abs(delta_x) - 50 >= 0 || Math.abs(delta_y) - 50 >= 0;
            const sqMag = delta_x * delta_x + delta_y * delta_y;
            if (sqMag > this.maxRadiusSquared) {
                const magnitude = Math.sqrt(sqMag);
                delta_x /= magnitude;
                delta_y /= magnitude;
                delta_x *= this.maxRadius;
                delta_y *= this.maxRadius;
            }
            
            this.domElement.style.left = `${20.0 + delta_x}px`;
            this.domElement.style.top = `${20.0 + delta_y}px`;            
            
            const forward = -delta_y / this.maxRadius;
            const turn = delta_x / this.maxRadius;
            
            if (this.onMove != undefined) this.onMove(forward, turn, run_status);
            
            evt.stopPropagation();
        };
        
        const up = (evt) => {            
            if ('ontouchstart' in window) {
                this.domCircle.ontouchmove = null;
                this.domCircle.ontouchend = null;
            }
            else {                
                document.onmousemove = null;
                document.onmouseup = null;
            }     
            this.domElement.style.top = `20.0px`;
            this.domElement.style.left = `20.0px`;
            if (this.onMove != undefined) this.onMove(0, 0, false);                        
            
            evt.stopPropagation();
        };
        
        const tap = (evt) =>
        {
            evt = evt || window.event;
            this.offset = this.getMousePosition(evt);
            
            if ('ontouchstart' in window) {
                this.domCircle.ontouchmove = move;
                this.domCircle.ontouchend = up;
            }
            else {                
                document.onmousemove = move;
                document.onmouseup = up;
            }
            
            evt.stopPropagation();
        };
        
        if (this.domElement != undefined) {         
            if ('ontouchstart' in window) {
                this.domElement.addEventListener('touchstart', tap);
            }
            else {
                this.domElement.addEventListener('mousedown', tap);
            }
        }
        
    }
    
    getMousePosition(evt) {
        let clientX = evt.targetTouches ? evt.targetTouches[0].pageX : evt.clientX;
        let clientY = evt.targetTouches ? evt.targetTouches[0].pageY : evt.clientY;
        return { x: clientX, y: clientY };
    }
}

// Tags
const create_default_controls = (doc)=>{
    if (doc.controls)
        doc.controls.dispose();
    doc.controls = new OrbitControls(doc.camera, doc.canvas);
    doc.controls.enableDamping = true;
    doc.controls.target.set(0, 1.5, 0);
}

const create_default_sky = (doc)=>{
    let col = new Color(0.318,0.318,0.318);
    col.convertLinearToSRGB();
    doc.scene.background = col;
    doc.bg_doc = null;
}

const create_default_env_light = (doc) =>{
    let sky_col = new Color(0.318,0.318,0.318);
    sky_col.convertLinearToSRGB();
    let ground_col = new Color(0.01, 0.025, 0.025);
    ground_col.convertLinearToSRGB();
    const envLight = new HemisphereLight(sky_col, ground_col);
    doc.scene.add(envLight);
    doc.envMap = null;
    doc.envLight = envLight;
}

const scene = {
    reset: (doc) => {
        doc.scene = new Scene();        
    },
    create: async (doc, props, parent) => {
        doc.scene = new Scene();
        create_default_sky(doc);
        create_default_env_light(doc);
        return doc.scene;
    }
}

const camera = {
    reset: (doc) => {
        doc.camera = new PerspectiveCamera(45, doc.width / doc.height, 0.1, 100);
        doc.camera.position.set(0, 1.5, 5.0);
    },

    create: async (doc, props, parent) => {
        let fov = 50.0;
        let near = 0.1;
        let far = 200.0;
        if (props.hasOwnProperty("fov"))
        {
            fov = parseFloat(props.fov);
        }
        if (props.hasOwnProperty("near"))
        {
            near = parseFloat(props.near);
        }
        if (props.hasOwnProperty("far"))
        {
            far = parseFloat(props.far);
        }
        doc.camera = new PerspectiveCamera(fov, doc.width / doc.height, near, far);
        create_default_controls(doc);
        return doc.camera;
    }
}


const control = {
    reset: (doc) => {
        create_default_controls(doc);
    },

    create: async (doc, props, parent) => {
        const type = props.type;
        if (type == 'orbit') {
            let from_x = 0.0;
            let from_y = 1.5;
            let from_z = 5.0;
            if (props.hasOwnProperty("look_from"))
            {
                let look_from = props.look_from.split(',');
                from_x = parseFloat(look_from[0]);
                from_y = parseFloat(look_from[1]);
                from_z = parseFloat(look_from[2]);
            }
            
            let to_x = 0.0;
            let to_y = 1.5;
            let to_z = 0.0;
            if (props.hasOwnProperty("look_at"))
            {
                let look_at = props.look_at.split(',');
                to_x = parseFloat(look_at[0]);
                to_y = parseFloat(look_at[1]);
                to_z = parseFloat(look_at[2]);    
            }            
           
            doc.camera.position.set(from_x, from_y, from_z);
            if (doc.controls != null)
                doc.controls.dispose();
            doc.controls = new OrbitControls(doc.camera, doc.canvas);
            doc.controls.enableDamping = true;
            doc.controls.target.set(to_x, to_y, to_z);
        }        
        return doc.controls;
    }
}


const sky = {
    reset: (doc) => {
        create_default_sky(doc);
    },

    create: async (doc, props, parent) => {        
        doc.scene.background = null;
        doc.bg_doc = null;
    
        let type = "hemisphere"
        if (props.hasOwnProperty("type"))
        {
            type = props.type;
        }
        
        if (type == "uniform")
        {
            let r = 1.0;
            let g = 1.0;
            let b = 1.0;
            if (props.hasOwnProperty('color'))
            {
                const color = props.color.split(',');
                r = parseFloat(color[0]);
                g = parseFloat(color[1]);
                b = parseFloat(color[2]);                
            }
            let col = new Color(r,g,b);
            col.convertLinearToSRGB();
            doc.scene.background = col;
            return col;
        }
        else if (type == "hemisphere")
        {
            let r = 0.318;
            let g = 0.318;
            let b = 0.318;
            if (props.hasOwnProperty('skyColor'))
            {
                const color = props.skyColor.split(',');
                r = parseFloat(color[0]);
                g = parseFloat(color[1]);
                b = parseFloat(color[2]);             
            }
            let col = new Color(r,g,b);
            col.convertLinearToSRGB();
            doc.scene.background = col;
            return col;
        }
        else if (type == "cube")
        {
            let url = "assets/textures/";
            let posx = "face0.jpg";
            let negx = "face1.jpg";
            let posy = "face2.jpg";
            let negy = "face3.jpg";
            let posz = "face4.jpg";
            let negz = "face5.jpg";
            
            if (props.hasOwnProperty('path'))
            {
                url = props.path+"/";
            }
            if (props.hasOwnProperty('posx'))
            {
                posx = props.posx;
            }
            if (props.hasOwnProperty('negx'))
            {
                negx = props.negx;
            }
            if (props.hasOwnProperty('posy'))
            {
                posy = props.posy;
            }
            if (props.hasOwnProperty('negy'))
            {
                negy = props.negy;
            }
            if (props.hasOwnProperty('posz'))
            {
                posz = props.posz;
            }
            if (props.hasOwnProperty('negz'))
            {
                negz = props.negz;
            }            
            
            const arr_images = [posx, negx, posy, negy, posz, negz];
            doc.skyLoader.setPath(doc.global_url(url));
            let bg = doc.skyLoader.load(arr_images);
            doc.scene.background = bg;
            return bg;
        }
        else if (type == "scene")
        {
            let path_scene = "terrain.xml";
            if (props.hasOwnProperty('scene'))
            {
                path_scene = props.scene;
            }
            
            let near = 10.0;
            let far = 10000.0;
            if (props.hasOwnProperty('near'))
            {
                near = parseFloat(props.near);
            }
            if (props.hasOwnProperty('far'))
            {
                far = parseFloat(props.far);
            }
            
            let bg_doc = new BackgroundDocument(doc, near, far);
            await bg_doc.load_xml(path_scene);            
            doc.bg_doc = bg_doc;
            return  bg_doc;
        }
    }
}

const env_light = {
    reset: (doc) => {
        create_default_env_light(doc);
    },
    create: async (doc, props, parent) => {
        if (doc.envMap!=null)
        {
            doc.scene.environment = null;
            doc.envMap = null;
        }
        if (doc.envLight!=null)
        {
            doc.scene.remove(doc.envLight);
            doc.envLight = null;
        }
        
        let type = "hemisphere"
        if (props.hasOwnProperty("type"))
        {
            type = props.type;
        }
        
        if (type == "uniform")
        {
            let r=1.0;
            let g=1.0;
            let b=1.0;
            if (props.hasOwnProperty('color'))
            {
                const color = props.color.split(',');
                r = parseFloat(color[0]);
                g = parseFloat(color[1]);
                b = parseFloat(color[2]);
            }
            let col = new Color(r,g,b);
            col.convertLinearToSRGB();
            
            let envLight = new AmbientLight(col);
            doc.scene.add(envLight);
            doc.envLight = envLight;
            return envLight;
        }
        else if (type == "hemisphere")
        {
            let sky_col, ground_col;
            {
                let r=0.318;
                let g=0.318;
                let b=0.318;
                if (props.hasOwnProperty('skyColor'))
                {
                    const color = props.skyColor.split(',');
                    r = parseFloat(color[0]);
                    g = parseFloat(color[1]);
                    b = parseFloat(color[2]);
                }
                sky_col = new Color(r,g,b);
                sky_col.convertLinearToSRGB();
            }
            {
                let r=0.01;
                let g=0.025;
                let b=0.025;
                if (props.hasOwnProperty('groundColor'))
                {
                    const color = props.skyColor.split(',');
                    r = parseFloat(color[0]);
                    g = parseFloat(color[1]);
                    b = parseFloat(color[2]);
                }
                ground_col = new Color(r,g,b);
                ground_col.convertLinearToSRGB();
            }            
            
            let envLight = new HemisphereLight(sky_col, ground_col);
            doc.scene.add(envLight);
            doc.envLight = envLight;            
            return envLight;
        }
        else if (type == "cube")
        {
            let irradiance_only = false;
            if (props.hasOwnProperty('irradiance_only'))
            {
                irradiance_only = string_to_boolean(props.irradiance_only);
            }
            
            if (irradiance_only)
            {
                let path_sh = "assets/sh.json";
                if (props.hasOwnProperty('path_sh'))
                {
                    path_sh = props.path_sh;
                }
                
                const response = await fetch(doc.global_url(path_sh));
                const text = await response.text();
                const coeffs = JSON.parse(text);                
                
                let lightProbe = new LightProbe();
                doc.scene.add(lightProbe);
                
                let arr = [];
                for (let v of coeffs)
                {
                    arr.push(new Vector3(v[0], v[1], v[2]));                    
                }
                lightProbe.sh.coefficients = arr;
                
                doc.envLight = lightProbe;            
                return lightProbe;
            }
            else
            {
                let url = "assets/textures/";
                let posx = "env_face0.jpg";
                let negx = "env_face1.jpg";
                let posy = "env_face2.jpg";
                let negy = "env_face3.jpg";
                let posz = "env_face4.jpg";
                let negz = "env_face5.jpg";
                
                if (props.hasOwnProperty('path'))
                {
                    url = props.path+"/";
                }
                if (props.hasOwnProperty('posx'))
                {
                    posx = props.posx;
                }
                if (props.hasOwnProperty('negx'))
                {
                    negx = props.negx;
                }
                if (props.hasOwnProperty('posy'))
                {
                    posy = props.posy;
                }
                if (props.hasOwnProperty('negy'))
                {
                    negy = props.negy;
                }
                if (props.hasOwnProperty('posz'))
                {
                    posz = props.posz;
                }
                if (props.hasOwnProperty('negz'))
                {
                    negz = props.negz;
                }
                
                const arr_images = [posx, negx, posy, negy, posz, negz];
                if (posx.split('.').pop()=="hdr")
                {
                    doc.HDRCubeLoader.setPath(doc.global_url(url));
                    let cube = doc.HDRCubeLoader.load(arr_images);
                    doc.scene.environment = cube;
                    doc.envMap = cube;
                    return cube;
                }
                else
                {
                    doc.skyLoader.setPath(doc.global_url(url));
                    let cube = doc.skyLoader.load(arr_images);            
                    doc.scene.environment = cube;
                    doc.envMap = cube;
                    return cube;
                }
            }
        }
        
    }
}

const group = {
    create: async (doc, props, parent) => {
        const group = new Group();
                
        if (parent != null) {
            parent.add(group);
        }
        else {
            doc.scene.add(group);
        }
        return group;
    }
}


const plane = {
    create: async (doc, props, parent) => {
        let width = 1.0;
        let height = 1.0;
        if (props.hasOwnProperty('size'))
        {
            let size = props.size.split(',');
            width = parseFloat(size[0]);
            height = parseFloat(size[1]);
        }        
        
        const geometry = new PlaneBufferGeometry(width, height);
        geometry.computeBoundsTree();
        const material = new MeshStandardMaterial();        
        const plane = new Mesh(geometry, material);        
        if (parent != null) {
            parent.add(plane);
        }
        else {
            doc.scene.add(plane);
        }
        return plane;
    }
}


const box = {
    create: async (doc, props, parent) => {
        let width = 1.0;
        let height = 1.0;
        let depth = 1.0;
        if (props.hasOwnProperty('size'))
        {
            let size = props.size.split(',');
            width = parseFloat(size[0]);
            height = parseFloat(size[1]);
            depth = parseFloat(size[2]);
        }        
        
        const geometry = new BoxBufferGeometry(width, height, depth);
        geometry.computeBoundsTree();
        const material = new MeshStandardMaterial();        
        const box = new Mesh(geometry, material);
                
        if (parent != null) {
            parent.add(box);
        }
        else {
            doc.scene.add(box);
        }
        return box;
    }
}


const sphere = {
    create: async (doc, props, parent) => {
        let radius = 1.0;
        if (props.hasOwnProperty('radius'))
        {
            radius = parseFloat(props.radius);
        }
        let widthSegments = 32;
        if (props.hasOwnProperty('widthSegments'))
        {
            widthSegments = parseInt(props.widthSegments);
        }
        let heightSegments = 16;
        if (props.hasOwnProperty('heightSegments'))
        {
            heightSegments = parseInt(props.heightSegments);
        }        
       
        const geometry = new SphereBufferGeometry(radius, widthSegments, heightSegments);
        geometry.computeBoundsTree();
        const material = new MeshStandardMaterial();
        const sphere = new Mesh(geometry, material);

        if (parent != null) {
            parent.add(sphere);
        }
        else {
            doc.scene.add(sphere);
        }
        return sphere;
    }
}


const model = {
    create: async (doc, props, parent) => {
        let src = "assets/models/model.glb";
        if (props.hasOwnProperty('src'))
        {
            src = props.src;
        }
        const url = doc.global_url(src);
        const modelData = await doc.modelLoader.loadAsync(url);
        const model = modelData.scene;
                
        model.traverse((child) => {
            if (child instanceof Mesh) {
                child.geometry.computeBoundsTree();
            }
        });
        
        if (props.hasOwnProperty('lightmap'))
        {
            let img_url = doc.global_url(props.lightmap);
            let ext = img_url.split('.').pop().toLowerCase();
            let img;
            if (ext=='hdr')
            {
                img = doc.lightmapLoader.load(img_url, (img)=>{                
                    img.flipY = false;
                });
                model.traverse((child) => {
                    if (child instanceof Mesh) {
                        child.material.lightMap = img;
                        child.material.lightMapIntensity = 3.1416;
                    }
                });
            }
            else if (ext=='csv')
            {
                const response = await fetch(img_url);
                const text = await response.text();
                if (text!=null)
                {                    
                    let camera = new OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
                    let renderer = doc.browser.renderer;
                    let target = null;
                    
                    const geometry = new PlaneBufferGeometry(2,2);
                    const material = new MeshStandardMaterial();
                    material.blending = CustomBlending;
                    material.blendSrc = OneFactor;
                    material.blendDst = OneFactor;
                    const plane = new Mesh(geometry, material);
                    let scene = new Scene();
                    scene.add(plane);
                    
                    let path = img_url.match(/(.*)[\/\\]/)[1]||'';
                    let lines = text.split(/\r?\n/);
                    for(let line of lines)
                    {
                        let fields = line.split(",");
                        if (fields.length<7) continue;
                        let fn_img = fields[0];
                        let range_low = new Vector3(parseFloat(fields[1]), parseFloat(fields[2]), parseFloat(fields[3]));
                        let range_high = new Vector3(parseFloat(fields[4]), parseFloat(fields[5]), parseFloat(fields[6]));
                        let img_in = doc.textureLoader.load(path + "/" + fn_img, (img_in)=>{
                            if (target == null)
                            {
                                let width = img_in.image.width;
                                let height = img_in.image.height;
                                target = new WebGLRenderTarget(width, height, { depthBuffer: false, type: HalfFloatType });                                
                                model.traverse((child) => {
                                    if (child instanceof Mesh) {
                                        child.material.lightMap = target.texture;
                                        child.material.lightMapIntensity = 3.1416;
                                        child.material.needsUpdate = true;
                                    }
                                });
                                
                                renderer.setRenderTarget(target);
                                renderer.setClearColor(new Color(0.0, 0.0, 0.0));
                                renderer.clearColor();
                                renderer.setRenderTarget(null);
                            }
                            img_in.flipY = false;
                            
                            renderer.setRenderTarget(target); 
                            
                            {
                                material.emissive = new Color(range_low.x, range_low.y, range_low.z);
                                material.emissiveMap = null;
                                material.needsUpdate = true;
                                renderer.render(scene, camera); 
                            }

                            {                                
                                material.emissive = new Color(range_high.x - range_low.x, range_high.y - range_low.y, range_high.z - range_low.z); 
                                material.emissiveMap = img_in;
                                material.needsUpdate = true;
                                renderer.render(scene, camera);
                            }
                            
                            renderer.setRenderTarget(null);                            
                        });
                    }
               }
            }
            else if (ext=='png' || ext == 'webp')
            {               
                doc.textureLoader.load(img_url, (img)=>{
                    img.flipY = false;                                    
                    let camera = new OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );                     
                    
                    let width = img.image.width;
                    let height = img.image.height;                    
                    let target = new WebGLRenderTarget(width, height, { depthBuffer: false, type: HalfFloatType });                                        
                    
                    model.traverse((child) => {
                        if (child instanceof Mesh) {
                            child.material.lightMap = target.texture;
                            child.material.lightMapIntensity = 3.1416;
                            child.material.needsUpdate = true;
                        }
                    }); 
                    
                    const geometry = new PlaneBufferGeometry(2,2);
                    const material = new MeshStandardMaterial();                   
                    const plane = new Mesh(geometry, material);
                    let scene = new Scene();
                    scene.add(plane);
                    
                    let renderer = doc.browser.renderer;
                    renderer.setRenderTarget(target);
                    renderer.setClearColor(new Color(0.0, 0.0, 0.0));
                    renderer.setClearAlpha(0.0);
                    renderer.clearColor();
                    
                    renderer.setRenderTarget(target); 
                    
                    material.map = img;
                    material.needsUpdate = true;
                    renderer.render(scene, camera); 

                    material.blending = CustomBlending;
                    material.blendSrc = DstAlphaFactor;
                    material.blendDst = ZeroFactor;
                    material.map = null;
                    material.emissive = new Color(16.0, 16.0, 16.0); 
                    material.emissiveMap = img;
                    material.needsUpdate = true;
                    renderer.render(scene, camera);
                    
                    renderer.setRenderTarget(null);
                    
                 });
            }
            
        }
       
        if (parent != null) {
            parent.add(model);
        }
        else {
            doc.scene.add(model);
        }
        return model;
    }
}

const avatar = {
    create: async (doc, props, parent) => {
        let avatar = await model.create(doc, props, parent);
        
        if (!props.hasOwnProperty('lookat_height')) {
            props.lookat_height = '1';
        }
        
        let lookat_height = parseFloat(props.lookat_height);
        avatar.state = "idle";
        avatar.move = null;
        
        const name_idle = props.name_idle;
        const name_forward = props.name_forward;
        const name_backward = props.name_backward;
        
        const cam = new Object3D();
        const camera_position = props.camera_position.split(',');
        const [camx, camy, camz] = camera_position
        cam.position.x = +camx;
        cam.position.y = +camy;
        cam.position.z = +camz;
        cam.parent = avatar;
        
        let mixer = new AnimationMixer(avatar.children[0]);
        
        const url_anim = props.url_anim;
        let animData = await doc.modelLoader.loadAsync(doc.global_url(url_anim));
        
        if (props.hasOwnProperty('fix_anims')) {
            doc.imported[props.fix_anims](animData);
        } 
        
        const clip_idle = animData.animations.find((e)=>e.name==name_idle);
        const action_idle = mixer.clipAction(clip_idle);
        action_idle.play();
        avatar.cur_action = action_idle;
        avatar.mixer = mixer;
        
        const onMove = (forward, turn, run_status)=>{
            avatar.move = { forward, turn};
            let action_changed = false;
            let new_action = null;
            
            if (forward > 0)
            {
                if (avatar.state != "forward")
                {
                    const clip_forward = animData.animations.find((e)=>e.name==name_forward);
                    new_action = mixer.clipAction(clip_forward);
                    action_changed = true;
                    avatar.state = "forward";
                }            
            }
            else if (forward < 0)
            {
                if (avatar.state != "backward")
                {
                    const clip_backward = animData.animations.find((e)=>e.name==name_backward);
                    new_action = mixer.clipAction(clip_backward);
                    action_changed = true;
                    avatar.state = "backward";
                }
            }
            else
            {
                if (avatar.state != "idle")
                {
                    const clip_idle = animData.animations.find((e)=>e.name==name_idle);
                    new_action = mixer.clipAction(clip_idle);
                    action_changed = true;
                    avatar.state = "idle";
                }
            }
            
            if (action_changed)
            {
                new_action.reset();
                new_action.crossFadeFrom(avatar.cur_action, 0.5);
                new_action.play();
                avatar.cur_action = new_action;
            }            
        };
        
        const joystick = new JoyStick({ onMove: onMove, doc: doc });
        
        if (doc.controls != null) {
            doc.controls.dispose();
            doc.controls = null;
        }
        
        const update_avatar = (doc, mixer, delta) => {
            mixer.update(delta);
            
            if (avatar.move) {
                if (avatar.move.forward != 0) {
                    let threshold = 0.4;
                    let movement = delta * avatar.move.forward * 2.0;
                    let pos = avatar.position.clone();
                    pos.y += threshold;
                    
                    if (doc.building.length > 0 && movement != 0) 
                    {
                        // cast front
                        {
                            let negated = false;
                            let dir = avatar.getWorldDirection(new Vector3());
                            if (avatar.move.forward < 0) 
                            {
                                dir.negate();
                                negated = true;
                            }
                            doc.raycaster.set(pos, dir);
                            const intersect = doc.raycaster.intersectObjects(doc.building);
                            if (intersect.length > 0) 
                            {
                                if (!negated)
                                {
                                    if (movement > intersect[0].distance - 0.3)
                                    {
                                        movement = intersect[0].distance - 0.3;
                                    }
                                }
                                else 
                                {
                                    if (-movement > intersect[0].distance - 0.3)
                                    {
                                        movement = 0.3 - intersect[0].distance;
                                    }
                                }
                            }
                        }
                    }
                    
                    avatar.translateZ(movement);
                    pos = avatar.position.clone();
                    pos.y += threshold;
                    
                    if (doc.building.length > 0) {
                        if (movement != 0) {
                            // cast up
                            {
                                let dir = new Vector3(0, 1, 0);
                                doc.raycaster.set(pos, dir);
                                const intersect = doc.raycaster.intersectObjects(doc.building);
                                if (intersect.length > 0) 
                                {
                                    const targetY = threshold + intersect[0].distance;
                                    if (targetY < 2.0) 
                                    {
                                        avatar.translateZ(-movement);
                                        pos = avatar.position.clone();
                                        pos.y += threshold;
                                    }
                                }
                            }
                            
                            // cast left
                            {
                                let cast_from = avatar.localToWorld(new Vector3(0,0,0));
                                let cast_to = avatar.localToWorld(new Vector3(1, 0, 0));
                                let dir = new Vector3();
                                dir.subVectors(cast_to, cast_from);                                                                     
                                doc.raycaster.set(pos, dir);
                                const intersect = doc.raycaster.intersectObjects(doc.building);
                                if (intersect.length > 0) 
                                {
                                    if (intersect[0].distance < 0.3) 
                                    {
                                        avatar.translateX(intersect[0].distance - 0.3);
                                        pos = avatar.position.clone();
                                        pos.y += threshold;
                                    }
                                }
                            }
                            
                            // cast right
                            {
                                let cast_from = avatar.localToWorld(new Vector3(0,0,0));
                                let cast_to = avatar.localToWorld(new Vector3(-1, 0, 0));
                                let dir = new Vector3();
                                dir.subVectors(cast_to, cast_from); 
                                
                                doc.raycaster.set(pos, dir);
                                const intersect = doc.raycaster.intersectObjects(doc.building);
                                if (intersect.length > 0) 
                                {
                                    if (intersect[0].distance < 0.3)
                                    {
                                        avatar.translateX(0.3 - intersect[0].distance);
                                        pos = avatar.position.clone();
                                        pos.y += threshold;
                                    }
                                }
                            }
                        }
                        
                        //cast down
                        {
                            let dir = new Vector3(0, -1, 0);
                            pos.y += 0.2;
                            doc.raycaster.set(pos, dir);
                            const gravity = 0.3;
                            const intersect = doc.raycaster.intersectObjects(doc.building);
                            if (intersect.length > 0) {
                                const targetY = pos.y - intersect[0].distance;
                                if (targetY > avatar.position.y) {
                                    //Going up
                                    avatar.position.y = 0.8 * avatar.position.y + 0.2 * targetY;
                                    avatar.velocityY = 0;
                                }
                                else if (targetY < avatar.position.y) {
                                    //Falling
                                    if (avatar.velocityY == undefined) avatar.velocityY = 0;
                                    avatar.velocityY += delta * gravity;
                                    avatar.position.y -= avatar.velocityY;
                                    if (avatar.position.y < targetY) {
                                        avatar.velocityY = 0;
                                        avatar.position.y = targetY;
                                    }
                                }
                            }
                        }                        
                    }                
                }
                if (avatar.move.turn != 0) {
                    avatar.rotateY(-avatar.move.turn * delta);
                }                
            }
            
            let look_from = cam.getWorldPosition(new Vector3());
            var look_at = avatar.position.clone();
            look_at.y += lookat_height;

            let dir = new Vector3();
            dir.subVectors(look_from, look_at);
            let dis = dir.length();
            dir.normalize();
            doc.raycaster.set(look_at, dir);
            const intersect = doc.raycaster.intersectObjects(doc.building);
            if (intersect.length > 0) {
                let max_dis = intersect[0].distance * 0.9;
                if (dis > max_dis) {
                    dir.multiplyScalar(max_dis);
                    look_from.addVectors(look_at, dir);
                }
            }

            doc.camera.position.lerp(look_from, 0.1);
            doc.camera.lookAt(look_at);            
        };
        doc.set_tick(mixer, update_avatar);
        
        return avatar;
        
    },
    remove: (doc, avatar) => {
        doc.remove_tick(avatar.mixer);
    }
}

const character = {
    create: async (doc, props, parent) => {
        const character = await model.create(doc, props, parent);
        character.state = "idle";
        character.move = null;      
        
        const mixer = new AnimationMixer(character.children[0]);
        character.mixer = mixer;
        
        const url_anim = props.url_anim;        
        const animData = await doc.modelLoader.loadAsync(doc.global_url(url_anim));
        if (props.hasOwnProperty('fix_anims')) {
            doc.imported[props.fix_anims](animData);
        }
        
        character.clip_idle = animData.animations.find((e)=>e.name==props.name_idle);
        character.clip_forward = animData.animations.find((e)=>e.name==props.name_forward);
        character.clip_backward = animData.animations.find((e)=>e.name==props.name_backward);
        
        const action_idle = mixer.clipAction(character.clip_idle);
        action_idle.play();
        character.cur_action = action_idle;

        const update_character = (doc, mixer, delta) => {
            mixer.update(delta);
        }
        doc.set_tick(mixer, update_character);
        
    },
    
    remove: (doc, character) => {
        doc.remove_tick(character.mixer);
    },
    
    set_state: (doc, character, state) => {
        var new_action = null;
        if (state == 'idle') {
            new_action = character.mixer.clipAction(character.clip_idle);
        }
        else if (state == 'forward') {
            new_action = character.mixer.clipAction(character.clip_forward);
        }
        else if (state == 'backward') {
            new_action = character.mixer.clipAction(character.clip_backward);
        }        

        if (new_action) {
            if (character.cur_action) {
                new_action.reset();
                new_action.crossFadeFrom(character.cur_action, 0.5);
            }
            new_action.play();
            character.cur_action = new_action;
        }
        character.state = state;
    }

    
}

const directional_light = {
    create: async (doc, props, parent) => {
        const light = new DirectionalLight();
                
        if (props.hasOwnProperty('intensity')) {
            light.intensity = parseFloat(props.intensity);
        }
        
        if (props.hasOwnProperty('target')) {
            const target_name = props.target;
            const target = doc.scene.getObjectByName(target_name);
            light.target = target;
        }
        
        if (props.hasOwnProperty('castShadow') && string_to_boolean(props.castShadow))
        {   
            light.castShadow = true;
            light.shadow.bias = -0.0003;
            
            let width = 512;
            let height = 512;
            if (props.hasOwnProperty('size')) {
                const size = props.size.split(',');
                width = parseInt(size[0]);
                height = parseInt(size[1]);
            }
            
            light.shadow.mapSize.width = width;
            light.shadow.mapSize.height = height;
            
            if (props.hasOwnProperty('area')) 
            {
                const area = props.area.split(',');                
                light.shadow.camera.left = parseFloat(area[0]);
                light.shadow.camera.right = parseFloat(area[1]);
                light.shadow.camera.bottom = parseFloat(area[2]);
                light.shadow.camera.top = parseFloat(area[3]);                

                if (area.length > 5) {
                    light.shadow.camera.near = parseFloat(area[4]);
                    light.shadow.camera.far = parseFloat(area[5]);
                }
            }
            
            if (props.hasOwnProperty('position')) {
                const position = props.position.split(',');
                light.position.x = parseFloat(position[0]);
                light.position.y = parseFloat(position[1]);
                light.position.z = parseFloat(position[2]);
            }
            
            let dir = new Vector3();
            dir.subVectors(light.position, light.target.position);
            dir.normalize();                        
            if (Math.abs(dir.y) < Math.abs(dir.x))
            {
                if (Math.abs(dir.z) < Math.abs(dir.y))
                {
                    light.shadow.camera.up.set(0,0,1);
                }
                else
                {
                    light.shadow.camera.up.set(0,1,0);
                }
            }
            else if (Math.abs(dir.z) < Math.abs(dir.x))
            {
                light.shadow.camera.up.set(0,0,1);
            }
            else
            {
                light.shadow.camera.up.set(1,0,0);
            }            
        }
        
        if (parent != null) {
            parent.add(light);
        }
        else {
            doc.scene.add(light);
        }
        return light;
    }
}

class BackgroundDocument
{
    constructor(doc, near, far)
    {
        if ("main_doc" in doc)
        {
            this.main_doc = doc.main_doc;
        }
        else
        {
            this.main_doc = doc;
        }
        this.textureLoader = this.main_doc.textureLoader;
        this.skyLoader = this.main_doc.skyLoader;
        this.lightmapLoader = this.main_doc.lightmapLoader;
        this.HDRCubeLoader = this.main_doc.HDRCubeLoader;
        this.modelLoader =  this.main_doc.modelLoader;       
        
        this.near = near;
        this.far = far;        
            
        this.Tags = { scene, sky, env_light, group, plane, box, sphere, model, directional_light };        
        this.tags_shadow = { plane, box, sphere, model};
        this.reset();
    }
    
    global_url(url) 
    {
        return this.main_doc.global_url(url);
    }
    
    reset() 
    {  
        for (let tag in this.Tags) {
            if (this.Tags[tag].hasOwnProperty('reset')) {
                this.Tags[tag].reset(this);
            }
        }
    }
    
    async create(tag, props, parent = null) {        
        if (!(tag in this.Tags)) return null;
        
        const obj = await this.Tags[tag].create(this, props, parent);
        if (obj == null) return null;
        
        if (Object.isExtensible(obj)) {
            obj.tag = tag;
        }
        
        if (props.hasOwnProperty('name')) {
            group.name = props.name;
        }
        
        if (props.hasOwnProperty('position')) {
            const position = props.position.split(',');
            obj.position.x = parseFloat(position[0]);
            obj.position.y = parseFloat(position[1]);
            obj.position.z = parseFloat(position[2]);
        }

        if (props.hasOwnProperty('rotation')) {
            const rotation = props.rotation.split(',');
            obj.rotation.x = parseFloat(rotation[0]) * Math.PI / 180.0;
            obj.rotation.y = parseFloat(rotation[1]) * Math.PI / 180.0;
            obj.rotation.z = parseFloat(rotation[2]) * Math.PI / 180.0;
        }

        if (props.hasOwnProperty('scale')) {
            const scale = props.scale.split(',');
            obj.scale.x = parseFloat(scale[0]);
            obj.scale.y = parseFloat(scale[1]);
            obj.scale.z = parseFloat(scale[2]);
        }

        if (props.hasOwnProperty('color')) {
            const color = props.color.split(',');
            const r = parseFloat(color[0]);
            const g = parseFloat(color[1]);
            const b = parseFloat(color[2]);
            obj.material.color.setRGB(r, g, b);
        }
        
        if (props.hasOwnProperty('texture'))
        {
            const tex = this.textureLoader.load(this.global_url(props.texture));
            tex.encoding = sRGBEncoding;
            obj.material.map = tex;            
        }
        
        if (props.hasOwnProperty('metalness'))
        {
            obj.material.metalness = parseFloat(props.metalness);
        }
        
        if (props.hasOwnProperty('roughness'))
        {
            obj.material.roughness = parseFloat(props.roughness);
        }
        
        if (tag in this.tags_shadow)
        {
            obj.traverse((child) => {
                if (child instanceof Mesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        }
        
        return obj;
    }
    
    
    
    async load_xml_node(xmlNode, parent = null) {
        if (parent == null) {
            parent = this;
        }
        for (let child of xmlNode.children) {
            let props = {};
            for (let i = 0; i < child.attributes.length; i++) {
                let attrib = child.attributes[i];
                props[attrib.name] = attrib.value;
            }
                       
            const obj = await this.create(child.nodeName, props, parent);            
            if (obj===null) continue;
            
            await this.load_xml_node(child, obj);
            if (obj.load) {
                obj.load(this, obj);
            }
        }
    }
    
    async load_xml(url)
    {
        const response = await fetch(this.global_url(url));
        const text = await response.text();        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");        
        let root = xmlDoc.documentElement;
        await this.load_xml_node(root);
    }
}

class MetaDocument {
    constructor(browser) {
        this.browser = browser;
        this.canvas = browser.renderer.domElement;
        this.width = browser.container.clientWidth;
        this.height = browser.container.clientHeight;
        this.working_path = "./";
        const engine_url = import.meta.url;
        this.engine_path = engine_url.substring(0, engine_url.lastIndexOf("/"));

        this.textureLoader = new TextureLoader();
        this.skyLoader = new CubeTextureLoader();
        this.lightmapLoader = new RGBELoader();
        this.HDRCubeLoader = new HDRCubeTextureLoader();
        this.modelLoader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath(this.engine_path + '/vendor/three/examples/js/libs/draco/');
        this.modelLoader.setDRACOLoader(dracoLoader);
        this.raycaster = new Raycaster();

        this.Tags = { scene, camera, control, sky, env_light, group, plane, box, sphere, model, avatar, character, directional_light};
        this.tags_shadow = { plane, box, sphere, model, avatar, character};

        this.reset();
    }

    global_url(url) {
        if (url.indexOf('://') > 0 || url.indexOf('//') === 0) {
            return url;
        }
        else {
            return getAbsoluteUrl(this.working_path + "/" + url);
        }
    }
    
    async load_text(url) {
        const g_url = this.global_url(url);
        const response = await fetch(g_url);
        return await response.text();
    }
    
    setSize() {
        this.canvas = this.browser.renderer.domElement;
        this.width = this.browser.container.clientWidth;
        this.height = this.browser.container.clientHeight;
        if (this.camera) {
            this.camera.aspect = this.width / this.height;
            this.camera.updateProjectionMatrix();
        }
    }
    
    reset() {
        
        this.updatables = [];
        this.building = [];        
        
        for (let tag in this.Tags) {
            if (this.Tags[tag].hasOwnProperty('reset')) {
                this.Tags[tag].reset(this);
            }
        }
    }
    
    tick(delta) {
        if (this.controls != null) {
            if (this.controls.hasOwnProperty('update')) {
                this.controls.update();
            }
        }
        
        for (const object of this.updatables) {
            object.tick(this, object, delta);
        }
    }
    
    render(renderer) {
        if (this.scene && this.camera) {
            renderer.clearColor();
            if (this.bg_doc!=null)
            {                
                let camera = new PerspectiveCamera(this.camera.fov, this.camera.aspect, this.bg_doc.near, this.bg_doc.far);   
                camera.position.copy(this.camera.position);
                camera.quaternion.copy(this.camera.quaternion);                
                renderer.render(this.bg_doc.scene, camera);
            }            
            renderer.render(this.scene, this.camera);
        }
    }
    
    set_tick(obj, func) {
        obj.tick = func;
        this.updatables.push(obj);
    }

    remove_tick(obj) {
        for (let i = 0; i < this.updatables.length; i++) {
            if (this.updatables[i] == obj) {
                this.updatables.splice(i, 1);
                i--;
            }
        }
    }
    
    add_building_object(obj) {
        this.building.push(obj);
    }

    remove_building_object(obj) {
        for (let i = 0; i < this.building.length; i++) {
            if (this.building[i] == obj) {
                this.building.splice(i, 1);
                i--;
            }
        }
    }
    
    async create(tag, props, parent = null) {        
        if (!(tag in this.Tags)) return null;
        
        const obj = await this.Tags[tag].create(this, props, parent);
        if (obj == null) return null;
        
        if (Object.isExtensible(obj)) {
            obj.tag = tag;
        }
        
        if (props.hasOwnProperty('name')) {
            group.name = props.name;
        }
        
        if (props.hasOwnProperty('position')) {
            const position = props.position.split(',');
            obj.position.x = parseFloat(position[0]);
            obj.position.y = parseFloat(position[1]);
            obj.position.z = parseFloat(position[2]);
        }

        if (props.hasOwnProperty('rotation')) {
            const rotation = props.rotation.split(',');
            obj.rotation.x = parseFloat(rotation[0]) * Math.PI / 180.0;
            obj.rotation.y = parseFloat(rotation[1]) * Math.PI / 180.0;
            obj.rotation.z = parseFloat(rotation[2]) * Math.PI / 180.0;
        }

        if (props.hasOwnProperty('scale')) {
            const scale = props.scale.split(',');
            obj.scale.x = parseFloat(scale[0]);
            obj.scale.y = parseFloat(scale[1]);
            obj.scale.z = parseFloat(scale[2]);
        }

        if (props.hasOwnProperty('color') && obj.hasOwnProperty('material')) {
            const color = props.color.split(',');
            const r = parseFloat(color[0]);
            const g = parseFloat(color[1]);
            const b = parseFloat(color[2]);
            obj.material.color.setRGB(r, g, b);
        }
        
        if (props.hasOwnProperty('texture'))
        {
            const tex = this.textureLoader.load(this.global_url(props.texture));
            tex.encoding = sRGBEncoding;
            obj.material.map = tex;            
        }
        
        if (props.hasOwnProperty('metalness'))
        {
            obj.material.metalness = parseFloat(props.metalness);
        }
        
        if (props.hasOwnProperty('roughness'))
        {
            obj.material.roughness = parseFloat(props.roughness);
        }
        
        if (tag in this.tags_shadow)
        {
            obj.traverse((child) => {
                if (child instanceof Mesh) {                    
                    child.castShadow = !child.material.transparent;
                    child.receiveShadow = true;                    
                }
            });
        }
        
        if (props.hasOwnProperty('is_building') && string_to_boolean(props.is_building)) {
            this.add_building_object(obj);
        }

        if (props.hasOwnProperty('ontick')) {
            this.set_tick(obj, this.imported[props.ontick]);
        }
        
        return obj;
    }
    
    
    remove(obj) // don't remove avatar
    {
        if (!(obj instanceof Object3D)) return;
        const doc = this;
        obj.traverse((child) => {
            if (child instanceof Object3D) {                
                this.remove_tick(child);
                this.remove_building_object(child);
                                
                if (child.hasOwnProperty('tag')) {
                    const tag = this.Tags[child.tag];
                    if (tag.hasOwnProperty('remove')) {
                        tag.remove(this, obj);
                    }
                }
            }
        });
        removeObject3D(obj);
    }
    
    async load_xml_node(xmlNode, parent = null) {
        if (parent == null) {
            parent = this;
        }
        for (let child of xmlNode.children) {
            let props = {};
            for (let i = 0; i < child.attributes.length; i++) {
                let attrib = child.attributes[i];
                props[attrib.name] = attrib.value;
            }
                       
            const obj = await this.create(child.nodeName, props, parent);            
            if (obj===null) continue;
            
            await this.load_xml_node(child, obj);
            if (obj.load) {
                obj.load(this, obj);
            }
        }
    }

    
    async load_xml(url)
    {
        const response = await fetch(this.global_url(url));
        const text = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");        
        let root = xmlDoc.documentElement;
        await this.load_xml_node(root);
    }
    
    async load_url(url) {
        this.url = url;
        this.working_path = url.substring(0, url.lastIndexOf("/"));
        this.reset();
        
        const g_url = this.global_url(url.substring(url.lastIndexOf("/") + 1));
        const module = await import(g_url);
        this.imported = module;
        await module.load(this);
    }
}

class MetaBrowser {
    constructor(address_bar = true) {
        const container = document.createElement("div");
        container.style.cssText = "position:absolute; width: 100%; height: 100%; background-color: skyblue;";
        document.body.appendChild(container);
        
        this.address_input = null;
        
        if (address_bar) {
            const address = document.createElement("div");
            address.style.cssText = "position: absolute; top: 5px; width: 100%; user-select: none;";
            document.body.appendChild(address);
            
            const btn_prev = document.createElement("button");
            btn_prev.textContent = "⇦";
            const btn_next = document.createElement("button");
            btn_next.textContent = "⇨";
            
            const address_input = document.createElement("input");
            address_input.style.cssText = "width: 60%;";
            
            address_input.addEventListener("keyup", (event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    this.load_url(address_input.value);
                }
            });
            
            btn_prev.addEventListener("click", () => {
                this.load_prev();
            });

            btn_next.addEventListener("click", () => {
                this.load_next();
            });
            
            address.appendChild(btn_prev);
            address.appendChild(btn_next);
            address.appendChild(address_input);

            this.address_input = address_input;
        }
        
        this.url_history = [];
        this.url_idx = -1;
        this.container = container;
        this.renderer = new WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.physicallyCorrectLights = true;
        this.renderer.outputEncoding = sRGBEncoding;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = PCFSoftShadowMap;
        this.renderer.autoClearColor = false;
        this.container.append(this.renderer.domElement);
        this.document = new MetaDocument(this);
        this.setSize()
        window.addEventListener('resize', () => this.setSize());
        this.clock = new Clock();
        this.renderer.setAnimationLoop(() => this.render());        
    }
    
    render() {
        const delta = this.clock.getDelta();
        this.document.tick(delta);
        this.document.render(this.renderer);
    }

    setSize() {
        this.document.setSize();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
    }
    
    async load_url(url) {
        if (this.url_idx < this.url_history.length - 1) {
            this.url_history.splice(this.url_idx + 1, this.url_history.length - this.url_idx - 1);
        }
        this.url_history.push(url);
        this.url_idx++;
        await this.document.load_url(url);
        if (this.address_input) {
            this.address_input.value = url;
        }
    }

    async load_prev() {
        if (this.url_idx > 0) {
            this.url_idx--;
            const url = this.url_history[this.url_idx];
            await this.document.load_url(url);
            if (this.address_input) {
                this.address_input.value = url;
            }
        }
    }

    async load_next() {
        if (this.url_idx < this.url_history.length - 1) {
            this.url_idx++;
            const url = this.url_history[this.url_idx];
            await this.document.load_url(url);
            if (this.address_input) {
                this.address_input.value = url;
            }
        }
    }
    
}

export { MetaBrowser };




