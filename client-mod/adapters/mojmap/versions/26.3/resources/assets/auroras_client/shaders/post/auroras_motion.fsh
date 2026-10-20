#version 330
#extension GL_ARB_separate_shader_objects : require

// Auroras Motion Blur (original shader): mixes the previous blurred frame into this one. The mix weight comes from
// the parameter texture (texel 1, alpha), set every frame from how fast the camera turns (core RenderFx.blurWeight,
// at most 0.9), so the picture is sharp while you aren't turning.

uniform sampler2D InSampler;
uniform sampler2D PrevSampler;
uniform sampler2D ParamsSampler;

layout(location = 0) in vec2 texCoord;

layout(location = 0) out vec4 fragColor;

void main() {
    float w = texelFetch(ParamsSampler, ivec2(1, 0), 0).a;
    vec3 cur = texture(InSampler, texCoord).rgb;
    vec3 prev = texture(PrevSampler, texCoord).rgb;
    fragColor = vec4(mix(cur, prev, clamp(w, 0.0, 0.9)), 1.0);
}
