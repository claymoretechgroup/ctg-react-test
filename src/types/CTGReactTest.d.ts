import type { ComponentType, ReactNode } from "react";
import CTGTest, {
    CTGTestPredicate,
    CTGTestConfig,
    MaybePromise
} from "ctg-js-test";
import ReactTestState, { ReactTestScreen } from "./ReactTestState.js";

// Config accepted by CTGReactTest.start. React-only keys are stripped before
// delegating to the base ctg-js-test config validator.
export interface CTGReactTestConfig extends CTGTestConfig {
    wrapper?: ComponentType<{ children?: ReactNode }> | null;
    autoCleanup?: boolean;
}

// Arguments passed to interact callbacks after the component has been mounted.
export interface CTGReactInteractContext {
    screen: ReactTestScreen;
    user: NonNullable<ReactTestState["user"]>;
}

export type CTGReactInteractFunction = (
    context: CTGReactInteractContext
) => MaybePromise<void>;

export type CTGReactAssertComponentFunction<Computed> = (
    screen: ReactTestScreen
) => MaybePromise<Computed>;

export interface CTGReactSnapshotNode {
    type: string;
    props: Record<string, unknown>;
    children: CTGReactSnapshot[] | null;
}

export type CTGReactSnapshot = CTGReactSnapshotNode | string | null;

export interface CTGReactSnapshotDiff {
    path: string;
    expected: unknown;
    actual: unknown;
}

// React-specialized CTGTest pipeline with typed component helpers.
export default class CTGReactTest<Input = ReactNode, Subject = Input>
    extends CTGTest<Input, Subject> {
    constructor(label: string);

    stage<Next>(
        label: string,
        fn: (state: ReactTestState<Subject>) => MaybePromise<Next>
    ): CTGReactTest<Input, Next>;

    assert<Computed>(
        label: string,
        fn: (state: ReactTestState<Subject>) => MaybePromise<Computed>,
        predicate: CTGTestPredicate<Computed>
    ): CTGReactTest<Input, Subject>;

    chain<Next>(
        label: string,
        pipeline: CTGTest<Subject, Next>
    ): CTGReactTest<Input, Next>;

    skip(
        targetLabel: string,
        condition?: (state: ReactTestState<Subject>) => MaybePromise<boolean>
    ): CTGReactTest<Input, Subject>;

    interact(
        label: string,
        fn: CTGReactInteractFunction
    ): CTGReactTest<Input, Subject>;

    assertComponent<Computed>(
        label: string,
        fn: CTGReactAssertComponentFunction<Computed>,
        expected: Computed | CTGTestPredicate<Computed>
    ): CTGReactTest<Input, Subject>;

    assertComponentIs(
        label: string,
        expected: string | ReactTestState
    ): CTGReactTest<Input, Subject>;

    start(
        subject: Input | ReactTestState<Input>,
        config?: CTGReactTestConfig | null
    ): Promise<ReactTestState<Subject>>;

    static init<Input = ReactNode>(label: string): CTGReactTest<Input, Input>;

    static toSnapshot(jsx: ReactNode): Promise<CTGReactSnapshot | CTGReactSnapshotNode[]>;

    static diffSnapshot(
        jsxA: ReactNode,
        jsxB: ReactNode
    ): Promise<CTGReactSnapshotDiff[]>;

    static compareSnapshot(jsxA: ReactNode, jsxB: ReactNode): Promise<boolean>;
}
