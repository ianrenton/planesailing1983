export default "uniform sampler2D colorTexture;\n\
\n\
varying vec2 v_textureCoordinates;\n\
\n\
float rand(vec2 co)\n\
{\n\
    return fract(sin(dot(co.xy ,vec2(12.9898, 78.233))) * 43758.5453);\n\
}\n\
\n\
void main(void)\n\
{\n\
    float noiseValue = rand(v_textureCoordinates + sin(czm_frameNumber)) * 0.1;\n\
    vec3 rgb = texture2D(colorTexture, v_textureCoordinates).rgb;\n\
    vec3 green = vec3(0.0, 1.0, 0.0);\n\
    gl_FragColor = vec4((noiseValue + rgb) * green, 1.0);\n\
}\n\
";
