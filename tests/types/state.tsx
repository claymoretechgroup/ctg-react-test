import { ReactTestState } from "ctg-react-test";
import type { ReactElement } from "react";

const element: ReactElement = <div>State</div>;
const state = new ReactTestState<ReactElement>({ subject: element, label: "state" });

state.container = document.createElement("div");
state.container.innerHTML = "<div>State</div>";

const html: string = state.toHTML();
const sameElement: ReactElement = state.subject;

state.data.count = 1;
state.screen?.queryByText("State");
state.rerender?.(<div>Next</div>);

html.toUpperCase();
sameElement.type.toString();

// @ts-expect-error subject is a ReactElement, not a number
state.subject.toFixed(2);

// @ts-expect-error data is Record<string, unknown>
state.data.count.toFixed(2);
