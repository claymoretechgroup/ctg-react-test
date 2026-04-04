// User interaction tests — click, type, form submission

import React from "react";
import CTGTest from "ctg-js-test";
import CTGReactTest from "../../src/CTGReactTest.js";
import { Counter, LoginForm } from "../components.js";

// :: OBJECT -> PROMISE(VOID)
// Runs all interaction tests.
export default async function run({ config }) {

    await CTGTest.init("interact: click button changes state")
        .stage("execute", async () => {
            const r = await CTGReactTest.init("counter interaction")
                .render("mount", React.createElement(Counter, { initial: 0 }))
                .assert("initial count", (ctx) => ctx.screen.getByTestId("count").textContent, "0")
                .interact("click increment", async (ctx) => {
                    await ctx.user.click(ctx.screen.getByText("Increment"));
                    return ctx;
                })
                .assert("count after click", (ctx) => ctx.screen.getByTestId("count").textContent, "1")
                .start(null, { output: "return-json", timeout: 0 });
            return r;
        })
        .assert("status pass", (r) => r.status, "pass")
        .start(null, config);

    await CTGTest.init("interact: multiple interactions")
        .stage("execute", async () => {
            const r = await CTGReactTest.init("multi click")
                .render("mount", React.createElement(Counter, { initial: 5 }))
                .interact("click twice", async (ctx) => {
                    await ctx.user.click(ctx.screen.getByText("Increment"));
                    await ctx.user.click(ctx.screen.getByText("Increment"));
                    return ctx;
                })
                .assert("count is 7", (ctx) => ctx.screen.getByTestId("count").textContent, "7")
                .start(null, { output: "return-json", timeout: 0 });
            return r;
        })
        .assert("status pass", (r) => r.status, "pass")
        .start(null, config);

    await CTGTest.init("interact: form submission")
        .stage("execute", async () => {
            const r = await CTGReactTest.init("login form")
                .render("mount", React.createElement(LoginForm))
                .assert("has form", (ctx) => ctx.screen.getByRole("form") !== null, true)
                .interact("fill and submit", async (ctx) => {
                    await ctx.user.type(ctx.screen.getByLabelText("Username"), "alice");
                    await ctx.user.click(ctx.screen.getByText("Submit"));
                    return ctx;
                })
                .assert("shows welcome", (ctx) => ctx.screen.getByText("Welcome, alice!") !== null, true)
                .start(null, { output: "return-json", timeout: 0 });
            return r;
        })
        .assert("status pass", (r) => r.status, "pass")
        .start(null, config);
}
