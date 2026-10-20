import { createUniqueId } from "solid-js";

/** The five equal participation bands, in increasing order. */
export const kittenMoods = ["devastated", "sad", "anxious", "happy", "ecstatic"] as const;

/** Get the expression for a completion percentage from zero through one hundred. */
export function kittenMood(progress: number) {
    return kittenMoods[Math.min(4, Math.floor(progress / 20))]!;
}

/** Draw a continuously animated kitten with five expressions. */
export function Kitten(props: { mood: (typeof kittenMoods)[number] }) {
    const fur = `${createUniqueId()}-fur`;

    return (
        <svg
            class={`survey-kitten survey-kitten--${props.mood}`}
            viewBox="0 0 400 320"
            role="img"
            aria-label={`${props.mood} kitten`}
        >
            <defs>
                <linearGradient id={fur} x1="0" y1="0" x2="0.2" y2="1">
                    <stop offset="0" stop-color="#d7dce8" />
                    <stop offset="1" stop-color="#919bb0" />
                </linearGradient>
            </defs>
            <ellipse cx="200" cy="298" rx="112" ry="12" fill="#e8e8ed" />
            <g class="kitten-tail" fill="none" stroke-linecap="round">
                <path
                    d="M254 279 C308 291 328 263 314 239 C308 229 302 231 304 242"
                    stroke="#303749"
                    stroke-width="22"
                />
                <path
                    d="M254 279 C308 291 328 263 314 239 C308 229 302 231 304 242"
                    stroke="#a6afc1"
                    stroke-width="15"
                />
            </g>
            <path
                d="M130 264 Q123 166 200 161 Q277 166 270 264 Q270 296 200 296 Q130 296 130 264"
                fill={`url(#${fur})`}
                stroke="#303749"
                stroke-width="4"
            />
            <ellipse cx="200" cy="252" rx="43" ry="42" fill="#fafafa" />
            <g fill={`url(#${fur})`} stroke="#303749" stroke-width="3" stroke-linecap="round">
                <path d="M148 211 Q140 235 149 267 Q153 278 165 275 Q175 272 171 260 L167 221" />
                <path d="M252 211 Q260 235 251 267 Q247 278 235 275 Q225 272 229 260 L233 221" />
                <path
                    d="M148 262 Q158 255 172 262 L172 267 Q173 277 162 278 Q151 278 148 269 Z"
                    fill="#fafafa"
                />
                <path
                    d="M252 262 Q242 255 228 262 L228 267 Q227 277 238 278 Q249 278 252 269 Z"
                    fill="#fafafa"
                />
                <path
                    d="M156 269 V274 M164 269 V275 M236 269 V275 M244 269 V274"
                    stroke="#a6afc1"
                    stroke-width="2"
                />
            </g>
            <g class="kitten-head">
                <g class="kitten-ear kitten-ear--left">
                    <path
                        d="M112 127 L100 38 Q101 25 115 34 L167 76"
                        fill="#9298aa"
                        stroke="#303749"
                        stroke-width="4"
                        stroke-linejoin="round"
                    />
                    <path d="M120 88 L114 49 L148 80" fill="#e8a6b2" />
                </g>
                <g class="kitten-ear kitten-ear--right">
                    <path
                        d="M288 127 L300 38 Q299 25 285 34 L233 76"
                        fill="#9298aa"
                        stroke="#303749"
                        stroke-width="4"
                        stroke-linejoin="round"
                    />
                    <path d="M280 88 L286 49 L252 80" fill="#e8a6b2" />
                </g>
                <path
                    d="M104 141 Q100 67 200 67 Q300 67 296 141 Q309 174 283 196 Q258 222 200 222 Q142 222 117 196 Q91 174 104 141 Z"
                    fill={`url(#${fur})`}
                    stroke="#303749"
                    stroke-width="4"
                />
                <path
                    d="M165 71 L177 98 M200 69 L200 101 M235 71 L223 98"
                    stroke="#72778a"
                    stroke-width="8"
                    stroke-linecap="round"
                />
                <ellipse cx="200" cy="185" rx="38" ry="24" fill="#fafafa" />
                <ellipse cx="127" cy="172" rx="17" ry="10" fill="#e6a0ad" opacity="0.45" />
                <ellipse cx="273" cy="172" rx="17" ry="10" fill="#e6a0ad" opacity="0.45" />
                <g class="kitten-face kitten-face--devastated">
                    <ellipse cx="151" cy="143" rx="27" ry="31" fill="white" />
                    <ellipse cx="249" cy="143" rx="27" ry="31" fill="white" />
                    <g class="kitten-gaze">
                        <ellipse cx="151" cy="143" rx="22" ry="26" fill="#303749" />
                        <ellipse cx="249" cy="143" rx="22" ry="26" fill="#303749" />
                        <ellipse cx="143" cy="133" rx="9" ry="11" fill="white" />
                        <ellipse cx="241" cy="133" rx="9" ry="11" fill="white" />
                        <circle cx="161" cy="153" r="4" fill="white" />
                        <circle cx="259" cy="153" r="4" fill="white" />
                    </g>
                    <path
                        d="M130 112 Q149 115 167 104 M233 104 Q251 115 270 112"
                        fill="none"
                        stroke="#303749"
                        stroke-width="5"
                        stroke-linecap="round"
                    />
                    <path
                        d="M126 160 Q151 177 176 160 Q170 178 151 178 Q132 177 126 160 M224 160 Q249 177 274 160 Q268 177 249 178 Q230 178 224 160"
                        fill="#94def3"
                    />
                    <path
                        class="kitten-tear-stream"
                        d="M132 170 C128 180 138 187 133 201 M268 170 C272 182 262 188 267 201"
                        fill="none"
                        stroke="#72c9e9"
                        stroke-width="9"
                        stroke-linecap="round"
                    />
                    <path
                        d="M132 173 C130 181 136 185 133 192 M268 173 C270 181 264 185 267 192"
                        fill="none"
                        stroke="#e2f8ff"
                        stroke-width="2.5"
                        stroke-linecap="round"
                    />
                    <g class="kitten-tear">
                        <path
                            d="M134 192 C132 199 124 204 125 211 C126 223 143 223 143 211 C143 204 136 199 134 192"
                            fill="#72c9e9"
                        />
                        <path
                            d="M130 207 Q127 214 132 215"
                            fill="none"
                            stroke="#d5f5ff"
                            stroke-width="2.5"
                            stroke-linecap="round"
                        />
                    </g>
                    <g class="kitten-tear kitten-tear--second">
                        <path
                            d="M266 192 C264 199 256 204 257 211 C258 223 275 223 275 211 C275 204 268 199 266 192"
                            fill="#72c9e9"
                        />
                        <path
                            d="M262 207 Q259 214 264 215"
                            fill="none"
                            stroke="#d5f5ff"
                            stroke-width="2.5"
                            stroke-linecap="round"
                        />
                    </g>
                    <path
                        d="M187 199 Q200 185 213 199"
                        fill="none"
                        stroke="#303749"
                        stroke-width="4"
                        stroke-linecap="round"
                    />
                </g>
                <g class="kitten-face kitten-face--sad">
                    <g class="kitten-gaze" fill="#303749">
                        <ellipse cx="151" cy="145" rx="21" ry="27" />
                        <ellipse cx="249" cy="145" rx="21" ry="27" />
                        <ellipse cx="144" cy="135" rx="8" ry="9" fill="white" />
                        <ellipse cx="242" cy="135" rx="8" ry="9" fill="white" />
                        <circle cx="159" cy="154" r="4" fill="#b7c7e5" />
                        <circle cx="257" cy="154" r="4" fill="#b7c7e5" />
                    </g>
                    <path
                        d="M129 118 L170 108 M230 108 L271 118 M186 199 Q200 188 214 199"
                        fill="none"
                        stroke="#303749"
                        stroke-width="5"
                        stroke-linecap="round"
                    />
                </g>
                <g class="kitten-face kitten-face--anxious">
                    <path
                        d="M126 135 Q151 169 176 141 Z M224 141 Q249 169 274 135 Z"
                        fill="white"
                    />
                    <g class="kitten-gaze">
                        <ellipse cx="156" cy="146" rx="6" ry="8" fill="#303749" />
                        <ellipse cx="254" cy="145" rx="6" ry="8" fill="#303749" />
                    </g>
                    <path
                        d="M125 134 L177 142 M223 142 L275 134 M130 116 L171 124 M230 121 L269 106"
                        fill="none"
                        stroke="#303749"
                        stroke-width="5"
                        stroke-linecap="round"
                    />
                    <path
                        d="M185 195 L215 192"
                        stroke="#303749"
                        stroke-width="4"
                        stroke-linecap="round"
                    />
                </g>
                <g class="kitten-face kitten-face--happy">
                    <g class="kitten-gaze" fill="#303749">
                        <ellipse cx="151" cy="141" rx="19" ry="25" />
                        <ellipse cx="249" cy="141" rx="19" ry="25" />
                        <circle cx="145" cy="133" r="8" fill="white" />
                        <circle cx="243" cy="133" r="8" fill="white" />
                    </g>
                    <ellipse cx="132" cy="169" rx="17" ry="8" fill="#ef9dad" />
                    <ellipse cx="268" cy="169" rx="17" ry="8" fill="#ef9dad" />
                    <path
                        d="M183 191 Q200 210 217 191"
                        fill="none"
                        stroke="#303749"
                        stroke-width="5"
                        stroke-linecap="round"
                    />
                </g>
                <g class="kitten-face kitten-face--ecstatic">
                    <path
                        d="M129 146 Q151 115 173 146 M227 146 Q249 115 271 146"
                        fill="none"
                        stroke="#303749"
                        stroke-width="7"
                        stroke-linecap="round"
                    />
                    <ellipse cx="132" cy="169" rx="17" ry="8" fill="#ef9dad" />
                    <ellipse cx="268" cy="169" rx="17" ry="8" fill="#ef9dad" />
                    <path
                        d="M179 184 Q200 198 221 184 Q219 216 200 214 Q181 216 179 184"
                        fill="#303749"
                    />
                    <path d="M187 206 Q200 197 213 206 Q200 220 187 206" fill="#ef9dad" />
                </g>
                <path
                    d="M193 174 Q200 170 207 174 Q204 179 200 180 Q196 179 193 174"
                    fill="#bc718b"
                />
                <path
                    d="M196 174 L202 174"
                    stroke="#f5c3d1"
                    stroke-width="2"
                    stroke-linecap="round"
                />
                <path
                    d="M122 178 Q105 172 91 174 M123 188 Q105 187 94 193 M278 178 Q295 172 309 174 M277 188 Q295 187 306 193"
                    stroke="#596174"
                    stroke-width="2.5"
                    stroke-linecap="round"
                />
            </g>
            <ellipse
                cx="153"
                cy="287"
                rx="29"
                ry="14"
                fill="#fafafa"
                stroke="#303749"
                stroke-width="4"
            />
            <ellipse
                cx="247"
                cy="287"
                rx="29"
                ry="14"
                fill="#fafafa"
                stroke="#303749"
                stroke-width="4"
            />
            <path
                d="M143 286 V294 M154 286 V296 M238 286 V296 M249 286 V294"
                stroke="#b3b9c7"
                stroke-width="2"
                stroke-linecap="round"
            />
        </svg>
    );
}
