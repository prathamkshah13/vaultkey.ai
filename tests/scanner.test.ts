import {test} from "node:test"
import assert  from "node:assert/strict"
import scanForSecrets from "@/lib/scanner"

test("Harmless code produces no findings", () =>{
    const input =  " const count = 42"
    const actual = scanForSecrets(input) 
    assert.deepStrictEqual(actual, [])
})

test("Finding for OpenAI credential on a line", () =>{
    const input =  "hello\nworld\nsk-abcdefghijklmnopqrstuvwxyz1234567890"
    const actual = scanForSecrets(input) 
    assert.deepStrictEqual(actual.length, 1)
    assert.deepStrictEqual(actual[0].provider, "openai")
    assert.deepStrictEqual(actual[0].maskedValue, "sk-a****7890")
    assert.strictEqual(actual[0].lineNumber, 3);
})

test("reports separate locations for the same credential repeated", () => {
    const input =
        "sk-abcdefghijklmnopqrstuvwxyz1234567890\n\nsk-abcdefghijklmnopqrstuvwxyz1234567890";

    const actual = scanForSecrets(input);

    assert.strictEqual(actual.length, 2);
    assert.strictEqual(actual[0].lineNumber, 1);
    assert.strictEqual(actual[1].lineNumber, 3);
});

test("detects and masks all three supported providers", () => {
    const input =
        "sk-abcdefghijklmnopqrstuvwxyz1234567890\nsk-ant-abcdefghijklmnopqrstuvwxyz1234567890\nAKIAABCDEFGHIJKLMNOP";

    const actual = scanForSecrets(input);

    assert.strictEqual(actual.length, 3);

    assert.strictEqual(actual[0].provider, "openai");
    assert.strictEqual(actual[0].maskedValue, "sk-a****7890");
    assert.strictEqual(actual[0].lineNumber, 1);

    assert.strictEqual(actual[1].provider, "anthropic");
    assert.strictEqual(actual[1].maskedValue, "sk-a****7890");
    assert.strictEqual(actual[1].lineNumber, 2);

    assert.strictEqual(actual[2].provider, "aws");
    assert.strictEqual(actual[2].maskedValue, "AKIA****MNOP");
    assert.strictEqual(actual[2].lineNumber, 3);
});

test("reports correct locations with Windows line endings", () => {
    const input =
        "hello\r\nworld\r\nsk-abcdefghijklmnopqrstuvwxyz1234567890";

    const actual = scanForSecrets(input);

    assert.strictEqual(actual.length, 1);
    assert.strictEqual(actual[0].lineNumber, 3);
});

test("orders findings by source position across different lines, not by provider", () => {
    const input =
        "sk-ant-abcdefghijklmnopqrstuvwxyz1234567890\nsk-abcdefghijklmnopqrstuvwxyz1234567890";

    const actual = scanForSecrets(input);

    assert.strictEqual(actual.length, 2);
    assert.strictEqual(actual[0].provider, "anthropic");
    assert.strictEqual(actual[0].lineNumber, 1);
    assert.strictEqual(actual[1].provider, "openai");
    assert.strictEqual(actual[1].lineNumber, 2);
});

test("orders findings left-to-right when multiple providers appear on the same line", () => {
    const input =
        "sk-ant-abcdefghijklmnopqrstuvwxyz1234567890 sk-abcdefghijklmnopqrstuvwxyz1234567890";

    const actual = scanForSecrets(input);

    assert.strictEqual(actual.length, 2);
    assert.strictEqual(actual[0].provider, "anthropic");
    assert.strictEqual(actual[0].lineNumber, 1);
    assert.strictEqual(actual[1].provider, "openai");
    assert.strictEqual(actual[1].lineNumber, 1);
});