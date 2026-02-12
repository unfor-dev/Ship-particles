import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'
import GUI from 'lil-gui'
import particlesVertexShader from './shaders/particles/vertex.glsl'
import particlesFragmentShader from './shaders/particles/fragment.glsl'
import gpgpuParticlesShader from './shaders/gpgpu/particles.glsl'

/**
 * Base
 */
// Debug
const gui = new GUI({ width: 340 })

const debugObject = {}

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Loader element
const loader = document.getElementById('loader')

// Scene
const scene = new THREE.Scene()

// Loaders
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('/draco/gltf/')

const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(dracoLoader)

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: Math.min(window.devicePixelRatio, 2)
}

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight
    sizes.pixelRatio = Math.min(window.devicePixelRatio, 2)

    // Materials
    if(particles.material)
        particles.material.uniforms.uResolution.value.set(sizes.width * sizes.pixelRatio, sizes.height * sizes.pixelRatio)

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(sizes.pixelRatio)
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(35, sizes.width / sizes.height, 0.1, 100)
camera.position.set(4.5, 4, 11)
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.dampingFactor = 0.05
controls.minDistance = 5
controls.maxDistance = 20
controls.enablePan = false
controls.autoRotate = true
controls.autoRotateSpeed = 0.1

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(sizes.pixelRatio)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.1

debugObject.clearColor = '#060608'
renderer.setClearColor(debugObject.clearColor)

/**
 * Gradient Background
 */
debugObject.bgTopColor = '#0f1b3d'
debugObject.bgBottomColor = '#060608'
debugObject.bgMidColor = '#0a1228'

const createGradientTexture = () =>
{
    const canvas2d = document.createElement('canvas')
    canvas2d.width = 2
    canvas2d.height = 512
    const ctx = canvas2d.getContext('2d')

    const gradient = ctx.createLinearGradient(0, 0, 0, 512)
    gradient.addColorStop(0.0, debugObject.bgTopColor)
    gradient.addColorStop(0.3, debugObject.bgMidColor)
    gradient.addColorStop(0.6, '#080c1a')
    gradient.addColorStop(1.0, debugObject.bgBottomColor)

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 2, 512)

    const texture = new THREE.CanvasTexture(canvas2d)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
}

const updateBackground = () =>
{
    if(scene.background && scene.background.dispose)
        scene.background.dispose()
    scene.background = createGradientTexture()
}

updateBackground()

/**
 * Stars — twinkling
 */
const starsCount = 1200
const starsPositions = new Float32Array(starsCount * 3)
const starsSizes = new Float32Array(starsCount)
const starsPhase = new Float32Array(starsCount)

for(let i = 0; i < starsCount; i++)
{
    const i3 = i * 3

    const radius = 25 + Math.random() * 50
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos((Math.random() * 2) - 1)

    starsPositions[i3 + 0] = radius * Math.sin(phi) * Math.cos(theta)
    starsPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
    starsPositions[i3 + 2] = radius * Math.cos(phi)

    starsSizes[i] = Math.random()
    starsPhase[i] = Math.random() * 6.28
}

const starsGeometry = new THREE.BufferGeometry()
starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3))
starsGeometry.setAttribute('aSize', new THREE.BufferAttribute(starsSizes, 1))
starsGeometry.setAttribute('aPhase', new THREE.BufferAttribute(starsPhase, 1))

const starsMaterial = new THREE.ShaderMaterial({
    uniforms:
    {
        uTime: new THREE.Uniform(0)
    },
    vertexShader: `
        uniform float uTime;
        attribute float aSize;
        attribute float aPhase;
        varying float vBrightness;

        void main()
        {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;

            // Twinkle
            float twinkle = sin(uTime * 1.5 + aPhase) * 0.5 + 0.5;
            twinkle = mix(0.3, 1.0, twinkle);

            vBrightness = twinkle * (0.5 + aSize * 0.5);

            gl_PointSize = (1.0 + aSize * 3.0) * twinkle;
            gl_PointSize *= (1.0 / -mvPosition.z) * 80.0;
        }
    `,
    fragmentShader: `
        varying float vBrightness;

        void main()
        {
            float dist = length(gl_PointCoord - 0.5);
            if(dist > 0.5) discard;

            // Soft round glow
            float alpha = exp(-dist * 6.0);

            // Subtle cross flare for bright stars
            vec2 p = gl_PointCoord - 0.5;
            float flareX = exp(-abs(p.y) * 20.0) * exp(-abs(p.x) * 4.0);
            float flareY = exp(-abs(p.x) * 20.0) * exp(-abs(p.y) * 4.0);
            alpha += (flareX + flareY) * 0.15 * vBrightness;

            // Warm-white color
            vec3 color = mix(vec3(0.8, 0.85, 1.0), vec3(1.0), vBrightness);

            gl_FragColor = vec4(color * vBrightness, alpha);
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
})

const starsPoints = new THREE.Points(starsGeometry, starsMaterial)
scene.add(starsPoints)

/**
 * Load model
 */
let gltf
try
{
    gltf = await gltfLoader.loadAsync('./model.glb')
}
catch(error)
{
    console.error('Failed to load model:', error)
    loader.querySelector('p').textContent = 'Failed to load model'
    throw error
}

/**
 * Base geometry
 */
const baseGeometry = {}
baseGeometry.instance = gltf.scene.children[0].geometry
baseGeometry.count = baseGeometry.instance.attributes.position.count

/**
 * GPU Compute
 */
// Setup
const gpgpu = {}
gpgpu.size = Math.ceil(Math.sqrt(baseGeometry.count))
gpgpu.computation = new GPUComputationRenderer(gpgpu.size, gpgpu.size, renderer)

// Base particles
const baseParticlesTexture = gpgpu.computation.createTexture()

for(let i = 0; i < baseGeometry.count; i++)
{
    const i3 = i * 3
    const i4 = i * 4

    // Position based on geometry
    baseParticlesTexture.image.data[i4 + 0] = baseGeometry.instance.attributes.position.array[i3 + 0]
    baseParticlesTexture.image.data[i4 + 1] = baseGeometry.instance.attributes.position.array[i3 + 1]
    baseParticlesTexture.image.data[i4 + 2] = baseGeometry.instance.attributes.position.array[i3 + 2]
    baseParticlesTexture.image.data[i4 + 3] = Math.random()
}

// Particles variable
gpgpu.particlesVariable = gpgpu.computation.addVariable('uParticles', gpgpuParticlesShader, baseParticlesTexture)
gpgpu.computation.setVariableDependencies(gpgpu.particlesVariable, [ gpgpu.particlesVariable ])

// Uniforms
gpgpu.particlesVariable.material.uniforms.uTime = new THREE.Uniform(0)
gpgpu.particlesVariable.material.uniforms.uDeltaTime = new THREE.Uniform(0)
gpgpu.particlesVariable.material.uniforms.uBase = new THREE.Uniform(baseParticlesTexture)
gpgpu.particlesVariable.material.uniforms.uFlowFieldInfluence = new THREE.Uniform(0.175)
gpgpu.particlesVariable.material.uniforms.uFlowFieldStrength = new THREE.Uniform(2)
gpgpu.particlesVariable.material.uniforms.uFlowFieldFrequency = new THREE.Uniform(0.5)

// Init
gpgpu.computation.init()

// Debug plane
gpgpu.debug = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 3),
    new THREE.MeshBasicMaterial({ map: gpgpu.computation.getCurrentRenderTarget(gpgpu.particlesVariable).texture })
)
gpgpu.debug.position.x = 3
gpgpu.debug.visible = false
scene.add(gpgpu.debug)

/**
 * Particles
 */
const particles = {}

// Geometry
const particlesUvArray = new Float32Array(baseGeometry.count * 2)
const sizesArray = new Float32Array(baseGeometry.count)

for(let y = 0; y < gpgpu.size; y++)
{
    for(let x = 0; x < gpgpu.size; x++)
    {
        const i = (y * gpgpu.size + x);
        const i2 = i * 2

        // UV
        const uvX = (x + 0.5) / gpgpu.size;
        const uvY = (y + 0.5) / gpgpu.size;

        particlesUvArray[i2 + 0] = uvX;
        particlesUvArray[i2 + 1] = uvY;

        // Size
        sizesArray[i] = Math.random()
    }
}

particles.geometry = new THREE.BufferGeometry()
particles.geometry.setDrawRange(0, baseGeometry.count)
particles.geometry.setAttribute('aParticlesUv', new THREE.BufferAttribute(particlesUvArray, 2))
particles.geometry.setAttribute('aColor', baseGeometry.instance.attributes.color)
particles.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizesArray, 1))

// Material
particles.material = new THREE.ShaderMaterial({
    vertexShader: particlesVertexShader,
    fragmentShader: particlesFragmentShader,
    uniforms:
    {
        uSize: new THREE.Uniform(0.128),
        uResolution: new THREE.Uniform(new THREE.Vector2(sizes.width * sizes.pixelRatio, sizes.height * sizes.pixelRatio)),
        uParticlesTexture: new THREE.Uniform(),
        uTime: new THREE.Uniform(0)
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
})

// Points
particles.points = new THREE.Points(particles.geometry, particles.material)
scene.add(particles.points)

/**
 * Tweaks
 */
// Scene folder
const sceneFolder = gui.addFolder('Scene')
sceneFolder.add(renderer, 'toneMappingExposure').min(0.1).max(3).step(0.01).name('Exposure')
sceneFolder.add(controls, 'autoRotate').name('Auto Rotate')
sceneFolder.add(controls, 'autoRotateSpeed').min(0).max(5).step(0.1).name('Rotate Speed')

// Background folder
const bgFolder = gui.addFolder('Background')
bgFolder.addColor(debugObject, 'bgTopColor').name('Top').onChange(updateBackground)
bgFolder.addColor(debugObject, 'bgMidColor').name('Middle').onChange(updateBackground)
bgFolder.addColor(debugObject, 'bgBottomColor').name('Bottom').onChange(updateBackground)

// Particles folder
const particlesFolder = gui.addFolder('Particles')
particlesFolder.add(particles.material.uniforms.uSize, 'value').min(0).max(1).step(0.001).name('uSize')

// Flow Field folder
const flowFieldFolder = gui.addFolder('Flow Field')
flowFieldFolder.add(gpgpu.particlesVariable.material.uniforms.uFlowFieldInfluence, 'value').min(0).max(1).step(0.001).name('Influence')
flowFieldFolder.add(gpgpu.particlesVariable.material.uniforms.uFlowFieldStrength, 'value').min(0).max(10).step(0.001).name('Strength')
flowFieldFolder.add(gpgpu.particlesVariable.material.uniforms.uFlowFieldFrequency, 'value').min(0).max(1).step(0.001).name('Frequency')

// Stars folder
const starsFolder = gui.addFolder('Stars')
starsFolder.add(starsPoints, 'visible').name('Show Stars')

// Debug folder
const debugFolder = gui.addFolder('Debug')
debugFolder.add(gpgpu.debug, 'visible').name('GPGPU Debug')
debugFolder.close()

/**
 * Hide loader
 */
loader.classList.add('hidden')
setTimeout(() => { loader.remove() }, 600)

/**
 * Animate
 */
const clock = new THREE.Clock()
let previousTime = 0
let animationId = null

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - previousTime
    previousTime = elapsedTime

    // Update controls
    controls.update()

    // Stars twinkle
    starsMaterial.uniforms.uTime.value = elapsedTime

    // Particle time
    particles.material.uniforms.uTime.value = elapsedTime

    // GPGPU Update
    gpgpu.particlesVariable.material.uniforms.uTime.value = elapsedTime
    gpgpu.particlesVariable.material.uniforms.uDeltaTime.value = deltaTime
    gpgpu.computation.compute()
    particles.material.uniforms.uParticlesTexture.value = gpgpu.computation.getCurrentRenderTarget(gpgpu.particlesVariable).texture

    // Render normal scene
    renderer.render(scene, camera)

    // Call tick again on the next frame
    animationId = window.requestAnimationFrame(tick)
}

tick()

/**
 * Visibility API — pause when tab is hidden
 */
document.addEventListener('visibilitychange', () =>
{
    if(document.hidden)
    {
        if(animationId)
        {
            cancelAnimationFrame(animationId)
            animationId = null
        }
        clock.stop()
    }
    else
    {
        clock.start()
        previousTime = clock.getElapsedTime()
        tick()
    }
})

/**
 * Music toggle button
 */
const audio = document.getElementById('backgroundMusic')
const musicButton = document.getElementById('musicButton')
let isPlaying = false

musicButton.addEventListener('click', () => {
    if (!isPlaying) {
        audio.play().catch((err) => {
            console.warn('Audio playback failed:', err)
        })
        musicButton.textContent = 'Pause'
        isPlaying = true
    } else {
        audio.pause()
        musicButton.textContent = 'Play'
        isPlaying = false
    }
})
