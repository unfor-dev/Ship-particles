varying vec3 vColor;
varying float vLife;

void main()
{
    float distanceToCenter = length(gl_PointCoord - 0.5);
    if(distanceToCenter > 0.5)
        discard;

    // Premium soft glow — bright core, soft edges
    float core = exp(-distanceToCenter * 8.0);
    float halo = exp(-distanceToCenter * 3.0);
    float alpha = mix(halo, core, 0.6);
    alpha *= smoothstep(0.5, 0.1, distanceToCenter);

    // Color with life-based warm shift
    vec3 color = vColor;

    // Hot core glow — white-ish center
    float coreGlow = exp(-distanceToCenter * 12.0);
    color = mix(color, vec3(1.0), coreGlow * 0.4);

    // Edge fade — particles dissolving get warmer
    float edgeWarm = smoothstep(0.6, 1.0, vLife);
    color = mix(color, color * vec3(1.2, 0.7, 0.4), edgeWarm * 0.5);

    // Brightness boost
    color *= 1.5;

    gl_FragColor = vec4(color, alpha);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
