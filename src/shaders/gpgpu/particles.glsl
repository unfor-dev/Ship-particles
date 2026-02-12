uniform float uTime;
uniform float uDeltaTime;
uniform sampler2D uBase;
uniform float uFlowFieldInfluence;
uniform float uFlowFieldStrength;
uniform float uFlowFieldFrequency;

#include ../includes/simplexNoise4d.glsl

void main()
{
    float time = uTime * 0.2;
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 particle = texture(uParticles, uv);
    vec4 base = texture(uBase, uv);

    // Dead — respawn
    if(particle.a >= 1.0)
    {
        particle.a = mod(particle.a, 1.0);
        particle.xyz = base.xyz;
    }

    // Alive
    else
    {
        // Strength
        float strength = simplexNoise4d(vec4(base.xyz * 0.2, time + 1.0));
        float influence = (uFlowFieldInfluence - 0.5) * (- 2.0);
        strength = smoothstep(influence, 1.0, strength);

        // Flow field
        vec3 flowField = vec3(
            simplexNoise4d(vec4(particle.xyz * uFlowFieldFrequency + 0.0, time)),
            simplexNoise4d(vec4(particle.xyz * uFlowFieldFrequency + 1.0, time)),
            simplexNoise4d(vec4(particle.xyz * uFlowFieldFrequency + 2.0, time))
        );
        flowField = normalize(flowField);
        particle.xyz += flowField * uDeltaTime * strength * uFlowFieldStrength;

        // Curl-like turbulence — adds swirl
        vec3 curl = vec3(
            simplexNoise4d(vec4(particle.xyz * 0.8 + 10.0, time * 0.5)),
            simplexNoise4d(vec4(particle.xyz * 0.8 + 20.0, time * 0.5)),
            simplexNoise4d(vec4(particle.xyz * 0.8 + 30.0, time * 0.5))
        );
        particle.xyz += curl * uDeltaTime * 0.15;

        // Gentle upward drift
        particle.xyz += vec3(0.0, uDeltaTime * 0.08, 0.0);

        // Decay
        particle.a += uDeltaTime * 0.3;
    }

    gl_FragColor = particle;
}
