#version 330
#extension GL_ARB_separate_shader_objects : require

// Auroras Color Grading (original shader). The same maths as core RenderFx.grade, which the unit tests check:
// brightness, warmth (orange/blue), tint (magenta/green), saturation around Rec. 709 luma, contrast around mid grey,
// then a vignette. The values come from a 2 x 1 parameter texture the mod updates (RenderFx.gradeTexture), so a
// settings change applies at once without reloading resources.

uniform sampler2D InSampler;
uniform sampler2D ParamsSampler;

layout(location = 0) in vec2 texCoord;

layout(location = 0) out vec4 fragColor;

void main() {
    vec4 p0 = texelFetch(ParamsSampler, ivec2(0, 0), 0);
    vec4 p1 = texelFetch(ParamsSampler, ivec2(1, 0), 0);
    float saturation = p0.r * 2.0;
    float contrast = 0.5 + p0.g;
    float brightness = 0.5 + p0.b;
    float warmth = p0.a * 2.0 - 1.0;
    float tint = p1.r * 2.0 - 1.0;
    float vignette = p1.g;
    float vignetteSize = p1.b;

    vec4 src = texture(InSampler, texCoord);
    vec3 c = src.rgb * brightness;
    c += vec3(warmth * 0.08 + tint * 0.04, -tint * 0.06, -warmth * 0.08 + tint * 0.04);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, saturation);
    c = (c - 0.5) * contrast + 0.5;
    vec2 d = (texCoord - 0.5) * 2.0;
    float inner = 1.0 - clamp(vignetteSize, 0.0, 1.0) * 0.9;
    float mask = smoothstep(inner - 0.1, 1.05, length(d) / sqrt(2.0));
    c *= 1.0 - vignette * mask;
    fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
