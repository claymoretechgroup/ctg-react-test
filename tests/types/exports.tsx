import CTGReactTest, {
    CTGTestConsoleFormatter,
    CTGTestJsonFormatter,
    CTGTestPredicates,
    CTGTestResult,
    ReactTestState
} from "ctg-react-test";
import type {
    CTGReactInteractContext,
    CTGReactSnapshotDiff,
    CTGReactTestConfig
} from "ctg-react-test";
import "ctg-react-test/jsx-loader";
import type { ReactElement, ReactNode } from "react";

function Greeting({ name }: { name: string }) {
    return <h1>Hello, {name}!</h1>;
}

const element: ReactElement<{ name: string }> = <Greeting name="World" />;
const state = await CTGReactTest.init<ReactElement<{ name: string }>>("exports")
    .assertComponent("heading", (screen) =>
        screen.getByRole("heading").textContent, "Hello, World!")
    .start(element);

const html: string = state.toHTML();
const subject: ReactElement<{ name: string }> = state.subject;

html.toUpperCase();
subject.props.name.toUpperCase();

const formatted: string = CTGTestConsoleFormatter.format(state);
const json: string = CTGTestJsonFormatter.format(state);
const passingStatus: 0 = CTGTestResult.STATUS.PASS;
const predicate = CTGTestPredicates.contains("World");

formatted.toUpperCase();
json.toUpperCase();
predicate.evaluate("Hello, World!");
state.status === passingStatus;

const manualState = ReactTestState.init("manual", element);
const manualHtml: string = manualState.toHTML();

manualHtml.toUpperCase();

const config: CTGReactTestConfig = {
    wrapper: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
    autoCleanup: false,
    haltOnFailure: true,
    timeout: 100
};

await CTGReactTest.init("config").start(<Greeting name="Config" />, config);

const contextHandler = async ({ screen, user }: CTGReactInteractContext) => {
    await user.click(screen.getByRole("button"));
};

CTGReactTest.init("interact").interact("click", contextHandler);

const diffs: CTGReactSnapshotDiff[] = await CTGReactTest.diffSnapshot(
    <Greeting name="A" />,
    <Greeting name="B" />
);

diffs.map((diff) => diff.path.toUpperCase());

// @ts-expect-error exported pipeline subject is a ReactElement, not a string
state.subject.toUpperCase();

// @ts-expect-error unknown config keys are rejected
await CTGReactTest.init("bad config").start(<Greeting name="Bad" />, { extra: true });
