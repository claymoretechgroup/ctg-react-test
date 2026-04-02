// Test components for ctg-react-test self-tests
// All components use React.createElement (no JSX transpiler)

import React, { useState, useCallback } from "react";

// Simple greeting component — renders props to DOM
export function Greeting({ name }) {
    return React.createElement("h1", null, `Hello, ${name}!`);
}

// Counter component with stateful increment/decrement
export function Counter({ initial = 0 }) {
    const [count, setCount] = useState(initial);
    const increment = useCallback(() => setCount((c) => c + 1), []);
    const decrement = useCallback(() => setCount((c) => c - 1), []);
    return React.createElement("div", null,
        React.createElement("span", { "data-testid": "count" }, String(count)),
        React.createElement("button", { onClick: increment }, "Increment"),
        React.createElement("button", { onClick: decrement }, "Decrement")
    );
}

// Form component with input, submission, and conditional rendering
export function LoginForm() {
    const [submitted, setSubmitted] = useState(false);
    const [username, setUsername] = useState("");
    return React.createElement("form", {
        role: "form",
        onSubmit: (e) => { e.preventDefault(); setSubmitted(true); }
    },
        submitted
            ? React.createElement("p", null, `Welcome, ${username}!`)
            : React.createElement(React.Fragment, null,
                React.createElement("label", { htmlFor: "user" }, "Username"),
                React.createElement("input", {
                    id: "user",
                    value: username,
                    onChange: (e) => setUsername(e.target.value)
                }),
                React.createElement("button", { type: "submit" }, "Submit")
            )
    );
}

// Custom hook for renderHook testing
export function useCounter(initial = 0) {
    const [count, setCount] = useState(initial);
    const increment = useCallback(() => setCount((c) => c + 1), []);
    const reset = useCallback(() => setCount(initial), [initial]);
    return { count, increment, reset };
}
