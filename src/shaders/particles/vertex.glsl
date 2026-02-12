uniform vec2 uResolution;
uniform float uSize;
uniform sampler2D uParticlesTexture;
uniform float uTime;

attribute vec2 aParticlesUv;
attribute vec3 aColor;
attribute float aSize;

varying vec3 vColor;
varying float vLife;

void main()
{
    vec4 particle = texture(uParticlesTexture, aParticlesUv);

    // Final position
    vec4 modelPosition = modelMatrix * vec4(particle.xyz, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_Position = projectedPosition;

    // Point size — smooth lifecycle
    float sizeIn = smoothstep(0.0, 0.15, particle.a);
    float sizeOut = 1.0 - smoothstep(0.6, 1.0, particle.a);
    float size = min(sizeIn, sizeOut);

    // Subtle pulse per particle
    float pulse = 1.0 + sin(uTime * 2.0 + aSize * 50.0) * 0.08;

    gl_PointSize = size * aSize * uSize * uResolution.y * pulse;
    gl_PointSize *= (1.0 / - viewPosition.z);

    // Color processing — boost saturation and vibrancy
    vec3 boostedColor = aColor;
    float luminance = dot(boostedColor, vec3(0.299, 0.587, 0.114));
    boostedColor = mix(vec3(luminance), boostedColor, 1.6);
    boostedColor *= 1.3;

    // Depth-based atmospheric tint — far particles get subtle blue
    float depth = smoothstep(-15.0, -5.0, viewPosition.z);
    boostedColor = mix(boostedColor * vec3(0.7, 0.8, 1.2), boostedColor, depth);

    // Varyings
    vColor = boostedColor;
    vLife = particle.a;
}
