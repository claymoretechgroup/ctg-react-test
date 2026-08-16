import { describe, expect, it } from "vitest";
import CTGReactTest, {
    CTGTestConsoleFormatter,
    CTGTestError,
    CTGTestPredicate,
    CTGTestPredicates,
    CTGTestResult,
    CTGTestState,
    ReactTestState
} from "ctg-react-test";
import { Greeting } from "./components.jsx";

describe("package exports", () => {

    it("exports base utilities through ctg-react-test root", async () => {
        const state = await CTGReactTest.init("root exports")
            .assertComponent("heading contains World", (screen) =>
                screen.getByRole("heading").textContent,
                CTGTestPredicates.contains("World"))
            .start(<Greeting name="World" />);

        expect(state).toBeInstanceOf(ReactTestState);
        expect(state).toBeInstanceOf(CTGTestState);
        expect(state.results[0].status).toBe(CTGTestResult.STATUS.PASS);
        expect(CTGTestConsoleFormatter.format(state)).toContain("root exports");
        expect(CTGTestPredicates.equals("x")).toBeInstanceOf(CTGTestPredicate);
        expect(new CTGTestError("INVALID_OPERATION").code).toBe(1000);
    });
});
