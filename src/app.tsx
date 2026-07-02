import { MetaProvider } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";

import { Shell } from "./component/shell";
import "./style.css";

export default function App() {
    return (
        <Router
            root={(props) => (
                <MetaProvider>
                    {/* route suspense */}
                    <Suspense>
                        <Shell>{props.children}</Shell>
                    </Suspense>
                </MetaProvider>
            )}
        >
            {/* routes */}
            <FileRoutes />
        </Router>
    );
}
