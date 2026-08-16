import CTGReactTest, { CTGTest, CTGTestPredicates } from "ctg-react-test";
import type { ReactElement } from "react";

function Counter({ initial = 0 }: { initial?: number }) {
    return (
        <div>
            <span data-testid="count">{initial}</span>
            <button>Increment</button>
        </div>
    );
}

const htmlState = await CTGReactTest.init<ReactElement>("pipeline")
    .assertComponent("count", (screen) =>
        Number(screen.getByTestId("count").textContent), 0)
    .stage("html", (state) => state.toHTML())
    .assert("html contains span", (state) => state.subject, CTGTestPredicates.contains("span"))
    .start(<Counter />);

htmlState.subject.toUpperCase();

// @ts-expect-error stage transformed the subject to string
htmlState.subject.toFixed(2);

const chained = CTGReactTest.init<ReactElement>("outer")
    .chain(
        "base chain",
        CTGTest.init<ReactElement>("inner")
            .stage("kind", (state) => state.subject.type)
    );

const chainedState = await chained.start(<Counter />);

chainedState.subject.toString();

// @ts-expect-error chained subject is not a ReactElement anymore
chainedState.subject.props;

// @ts-expect-error assertComponent callbacks receive screen, not state
CTGReactTest.init("bad assert").assertComponent("bad", (state) => state.subject, "x");
