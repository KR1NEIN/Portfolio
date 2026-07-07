const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [1, 1, 1];
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ];
};

const vertexSrc = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentSrc = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uTimeSpeed;
uniform float uColorBalance;
uniform float uWarpStrength;
uniform float uWarpFrequency;
uniform float uWarpSpeed;
uniform float uWarpAmplitude;
uniform float uBlendAngle;
uniform float uBlendSoftness;
uniform float uRotationAmount;
uniform float uNoiseScale;
uniform float uGrainAmount;
uniform float uGrainScale;
uniform float uGrainAnimated;
uniform float uContrast;
uniform float uGamma;
uniform float uSaturation;
uniform vec2 uCenterOffset;
uniform float uZoom;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
out vec4 fragColor;
#define S(a,b,t) smoothstep(a,b,t)
mat2 Rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
vec2 hash(vec2 p){
  p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37)));
  return fract(sin(p)*43758.5453);
}
float noise(vec2 p){
  vec2 i=floor(p);
  vec2 f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  vec2 h00=-1.0+2.0*hash(i+vec2(0.0,0.0));
  vec2 h10=-1.0+2.0*hash(i+vec2(1.0,0.0));
  vec2 h01=-1.0+2.0*hash(i+vec2(0.0,1.0));
  vec2 h11=-1.0+2.0*hash(i+vec2(1.0,1.0));
  float d00=dot(h00,f-vec2(0.0,0.0));
  float d10=dot(h10,f-vec2(1.0,0.0));
  float d01=dot(h01,f-vec2(0.0,1.0));
  float d11=dot(h11,f-vec2(1.0,1.0));
  float sx=mix(d00,d10,u.x);
  float sy=mix(d01,d11,u.x);
  float n=mix(sx,sy,u.y);
  return 0.5+0.5*n;
}
void mainImage(out vec4 o, vec2 C){
  float t=iTime*uTimeSpeed;
  vec2 uv=C/iResolution.xy;
  float ratio=iResolution.x/iResolution.y;
  vec2 tuv=uv-0.5+uCenterOffset;
  tuv/=max(uZoom,0.001);

  float degree=noise(vec2(t*0.1,tuv.x*tuv.y)*uNoiseScale);
  tuv.y*=1.0/ratio;
  tuv*=Rot(radians((degree-0.5)*uRotationAmount+180.0));
  tuv.y*=ratio;

  float frequency=uWarpFrequency;
  float ws=max(uWarpStrength,0.001);
  float amplitude=uWarpAmplitude/ws;
  float warpTime=t*uWarpSpeed;
  tuv.x+=sin(tuv.y*frequency+warpTime)/amplitude;
  tuv.y+=sin(tuv.x*(frequency*1.5)+warpTime)/(amplitude*0.5);

  vec3 colLav=uColor1;
  vec3 colOrg=uColor2;
  vec3 colDark=uColor3;
  float b=uColorBalance;
  float s=max(uBlendSoftness,0.0);
  mat2 blendRot=Rot(radians(uBlendAngle));
  float blendX=(tuv*blendRot).x;
  float edge0=-0.3-b-s;
  float edge1=0.2-b+s;
  float v0=0.5-b+s;
  float v1=-0.3-b-s;
  vec3 layer1=mix(colDark,colOrg,S(edge0,edge1,blendX));
  vec3 layer2=mix(colOrg,colLav,S(edge0,edge1,blendX));
  vec3 col=mix(layer1,layer2,S(v0,v1,tuv.y));

  vec2 grainUv=uv*max(uGrainScale,0.001);
  if(uGrainAnimated>0.5){grainUv+=vec2(iTime*0.05);}
  float grain=fract(sin(dot(grainUv,vec2(12.9898,78.233)))*43758.5453);
  col+=(grain-0.5)*uGrainAmount;

  col=(col-0.5)*uContrast+0.5;
  float luma=dot(col,vec3(0.2126,0.7152,0.0722));
  col=mix(vec3(luma),col,uSaturation);
  col=pow(max(col,0.0),vec3(1.0/max(uGamma,0.001)));
  col=clamp(col,0.0,1.0);

  o=vec4(col,1.0);
}
void main(){
  vec4 o=vec4(0.0);
  mainImage(o,gl_FragCoord.xy);
  fragColor=o;
}
`;

class Grainient {
  constructor(container, options = {}) {
    this.container =
      typeof container === "string"
        ? document.querySelector(container)
        : container;
    if (!this.container) return;

    const {
      timeSpeed = 0.25,
      colorBalance = 0.0,
      warpStrength = 1.0,
      warpFrequency = 5.0,
      warpSpeed = 2.0,
      warpAmplitude = 50.0,
      blendAngle = 0.0,
      blendSoftness = 0.05,
      rotationAmount = 500.0,
      noiseScale = 2.0,
      grainAmount = 0.1,
      grainScale = 2.0,
      grainAnimated = false,
      contrast = 1.5,
      gamma = 1.0,
      saturation = 1.0,
      centerX = 0.0,
      centerY = 0.0,
      zoom = 0.9,
      color1 = "#FF9FFC",
      color2 = "#5227FF",
      color3 = "#B497CF",
    } = options;

    this.options = {
      timeSpeed,
      colorBalance,
      warpStrength,
      warpFrequency,
      warpSpeed,
      warpAmplitude,
      blendAngle,
      blendSoftness,
      rotationAmount,
      noiseScale,
      grainAmount,
      grainScale,
      grainAnimated,
      contrast,
      gamma,
      saturation,
      centerX,
      centerY,
      zoom,
      color1,
      color2,
      color3,
    };

    this._init();
  }

  _init() {
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    this.canvas = canvas;
    this.container.appendChild(canvas);

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    if (!gl) {
      console.warn("WebGL2 not supported");
      return;
    }
    this.gl = gl;

    const vertexShader = this._createShader(gl.VERTEX_SHADER, vertexSrc);
    const fragmentShader = this._createShader(gl.FRAGMENT_SHADER, fragmentSrc);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return;
    }
    this.program = program;

    const vertices = new Float32Array([
      -1, -1,
       3, -1,
      -1,  3,
    ]);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    this._uniforms = {};
    const uniformNames = [
      "iResolution", "iTime", "uTimeSpeed", "uColorBalance",
      "uWarpStrength", "uWarpFrequency", "uWarpSpeed", "uWarpAmplitude",
      "uBlendAngle", "uBlendSoftness", "uRotationAmount", "uNoiseScale",
      "uGrainAmount", "uGrainScale", "uGrainAnimated", "uContrast",
      "uGamma", "uSaturation", "uCenterOffset", "uZoom",
      "uColor1", "uColor2", "uColor3",
    ];
    uniformNames.forEach((name) => {
      this._uniforms[name] = gl.getUniformLocation(program, name);
    });

    this._raf = 0;
    this._isVisible = true;
    this._isPageVisible = !document.hidden;
    this._t0 = performance.now();
    this._dpr = Math.min(window.devicePixelRatio || 1, 2);

    this._setSize = this._setSize.bind(this);
    this._loop = this._loop.bind(this);
    this._tryStart = this._tryStart.bind(this);
    this._tryStop = this._tryStop.bind(this);
    this._onVisibility = this._onVisibility.bind(this);

    this._syncAllUniforms();

    // Debounced resize handler (200ms) to avoid excessive redraws
    this._resizeTimeout = null;
    this._ro = new ResizeObserver(() => {
      if (this._resizeTimeout) clearTimeout(this._resizeTimeout);
      this._resizeTimeout = setTimeout(() => this._setSize(), 200);
    });
    this._ro.observe(this.container);
    this._setSize();

    this._io = new IntersectionObserver(
      ([entry]) => {
        this._isVisible = entry.isIntersecting;
        this._isVisible ? this._tryStart() : this._tryStop();
      },
      { threshold: 0 }
    );
    this._io.observe(this.container);

    document.addEventListener("visibilitychange", this._onVisibility);

    this._tryStart();
  }

  _createShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  _setSize() {
    if (!this.gl) return;
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * this._dpr));
    const h = Math.max(1, Math.floor(rect.height * this._dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
    this._setUniform2f("iResolution", w, h);
    this._render();
  }

  _syncAllUniforms() {
    if (!this.program) return;
    const o = this.options;
    this.gl.useProgram(this.program);
    this._setUniform1f("uTimeSpeed", o.timeSpeed);
    this._setUniform1f("uColorBalance", o.colorBalance);
    this._setUniform1f("uWarpStrength", o.warpStrength);
    this._setUniform1f("uWarpFrequency", o.warpFrequency);
    this._setUniform1f("uWarpSpeed", o.warpSpeed);
    this._setUniform1f("uWarpAmplitude", o.warpAmplitude);
    this._setUniform1f("uBlendAngle", o.blendAngle);
    this._setUniform1f("uBlendSoftness", o.blendSoftness);
    this._setUniform1f("uRotationAmount", o.rotationAmount);
    this._setUniform1f("uNoiseScale", o.noiseScale);
    this._setUniform1f("uGrainAmount", o.grainAmount);
    this._setUniform1f("uGrainScale", o.grainScale);
    this._setUniform1f("uGrainAnimated", o.grainAnimated ? 1.0 : 0.0);
    this._setUniform1f("uContrast", o.contrast);
    this._setUniform1f("uGamma", o.gamma);
    this._setUniform1f("uSaturation", o.saturation);
    this._setUniform2f("uCenterOffset", o.centerX, o.centerY);
    this._setUniform1f("uZoom", o.zoom);
    const c1 = hexToRgb(o.color1);
    const c2 = hexToRgb(o.color2);
    const c3 = hexToRgb(o.color3);
    this._setUniform3f("uColor1", c1[0], c1[1], c1[2]);
    this._setUniform3f("uColor2", c2[0], c2[1], c2[2]);
    this._setUniform3f("uColor3", c3[0], c3[1], c3[2]);
  }

  _setUniform1f(name, v) {
    const loc = this._uniforms[name];
    if (loc !== null) this.gl.uniform1f(loc, v);
  }
  _setUniform2f(name, x, y) {
    const loc = this._uniforms[name];
    if (loc !== null) this.gl.uniform2f(loc, x, y);
  }
  _setUniform3f(name, x, y, z) {
    const loc = this._uniforms[name];
    if (loc !== null) this.gl.uniform3f(loc, x, y, z);
  }

  _render() {
    if (!this.gl) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  _loop(t) {
    if (!this.gl) return;
    // 30fps cap for background animation to save GPU
    const fpsInterval = 1000 / 30;
    if (!this._lastFrameTime) this._lastFrameTime = t;
    const elapsed = t - this._lastFrameTime;
    if (elapsed >= fpsInterval) {
      this._lastFrameTime = t - (elapsed % fpsInterval);
      this._setUniform1f("iTime", (t - this._t0) * 0.001);
      this._render();
    }
    this._raf = requestAnimationFrame(this._loop);
  }

  _tryStart() {
    if (this._isVisible && this._isPageVisible && this._raf === 0) {
      this._raf = requestAnimationFrame(this._loop);
    }
  }

  _tryStop() {
    if (this._raf !== 0) {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
  }

  _onVisibility() {
    this._isPageVisible = !document.hidden;
    this._isPageVisible ? this._tryStart() : this._tryStop();
  }

  setOptions(options = {}) {
    if (!this.program) return;
    Object.assign(this.options, options);
    this.gl.useProgram(this.program);
    if (options.timeSpeed !== undefined)
      this._setUniform1f("uTimeSpeed", options.timeSpeed);
    if (options.colorBalance !== undefined)
      this._setUniform1f("uColorBalance", options.colorBalance);
    if (options.warpStrength !== undefined)
      this._setUniform1f("uWarpStrength", options.warpStrength);
    if (options.warpFrequency !== undefined)
      this._setUniform1f("uWarpFrequency", options.warpFrequency);
    if (options.warpSpeed !== undefined)
      this._setUniform1f("uWarpSpeed", options.warpSpeed);
    if (options.warpAmplitude !== undefined)
      this._setUniform1f("uWarpAmplitude", options.warpAmplitude);
    if (options.blendAngle !== undefined)
      this._setUniform1f("uBlendAngle", options.blendAngle);
    if (options.blendSoftness !== undefined)
      this._setUniform1f("uBlendSoftness", options.blendSoftness);
    if (options.rotationAmount !== undefined)
      this._setUniform1f("uRotationAmount", options.rotationAmount);
    if (options.noiseScale !== undefined)
      this._setUniform1f("uNoiseScale", options.noiseScale);
    if (options.grainAmount !== undefined)
      this._setUniform1f("uGrainAmount", options.grainAmount);
    if (options.grainScale !== undefined)
      this._setUniform1f("uGrainScale", options.grainScale);
    if (options.grainAnimated !== undefined)
      this._setUniform1f("uGrainAnimated", options.grainAnimated ? 1.0 : 0.0);
    if (options.contrast !== undefined)
      this._setUniform1f("uContrast", options.contrast);
    if (options.gamma !== undefined)
      this._setUniform1f("uGamma", options.gamma);
    if (options.saturation !== undefined)
      this._setUniform1f("uSaturation", options.saturation);
    if (options.centerX !== undefined || options.centerY !== undefined) {
      this._setUniform2f(
        "uCenterOffset",
        options.centerX !== undefined ? options.centerX : this.options.centerX,
        options.centerY !== undefined ? options.centerY : this.options.centerY
      );
    }
    if (options.zoom !== undefined)
      this._setUniform1f("uZoom", options.zoom);
    if (options.color1 !== undefined) {
      const c = hexToRgb(options.color1);
      this._setUniform3f("uColor1", c[0], c[1], c[2]);
    }
    if (options.color2 !== undefined) {
      const c = hexToRgb(options.color2);
      this._setUniform3f("uColor2", c[0], c[1], c[2]);
    }
    if (options.color3 !== undefined) {
      const c = hexToRgb(options.color3);
      this._setUniform3f("uColor3", c[0], c[1], c[2]);
    }
  }

  destroy() {
    this._tryStop();
    if (this._resizeTimeout) clearTimeout(this._resizeTimeout);
    if (this._ro) this._ro.disconnect();
    if (this._io) this._io.disconnect();
    document.removeEventListener("visibilitychange", this._onVisibility);
    if (this.canvas && this.canvas.parentNode) {
      try {
        this.canvas.parentNode.removeChild(this.canvas);
      } catch (e) {}
    }
    this.gl = null;
    this.program = null;
  }
}

window.Grainient = Grainient;
