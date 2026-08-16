import type { BoundFunctions, RenderResult, queries } from "@testing-library/react";
import { CTGTestState, CTGTestStateOptions } from "ctg-js-test";

// Testing Library query functions bound to the rendered component container.
export type ReactTestScreen = BoundFunctions<typeof queries>;

// Structural surface returned by @testing-library/user-event's setup().
// Kept local so this package's declarations do not require the optional peer.
export interface ReactTestUser {
    click(element: Element, options?: unknown): Promise<void>;
    dblClick(element: Element, options?: unknown): Promise<void>;
    tripleClick(element: Element, options?: unknown): Promise<void>;
    hover(element: Element, options?: unknown): Promise<void>;
    unhover(element: Element, options?: unknown): Promise<void>;
    type(element: Element, text: string, options?: unknown): Promise<void>;
    clear(element: Element): Promise<void>;
    selectOptions(element: Element, values: unknown, options?: unknown): Promise<void>;
    deselectOptions(element: Element, values: unknown, options?: unknown): Promise<void>;
    upload(element: HTMLElement, fileOrFiles: unknown): Promise<void>;
    tab(options?: unknown): Promise<void>;
    keyboard(text: string): Promise<void>;
}

// React-specific mutable state threaded through a CTGReactTest pipeline.
export default class ReactTestState<Subject = unknown, Computed = unknown>
    extends CTGTestState<Subject, Computed> {
    screen: ReactTestScreen | null;
    user: ReactTestUser | null;
    container: HTMLElement | null;
    rerender: RenderResult["rerender"] | null;
    data: Record<string, unknown>;

    constructor(options?: CTGTestStateOptions<Subject>);

    toHTML(): string;

    static init<Subject = unknown>(
        label: string,
        subject: Subject
    ): ReactTestState<Subject>;
}
