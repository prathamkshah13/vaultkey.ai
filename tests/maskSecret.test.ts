import {test} from "node:test"
import assert from "node:assert/strict"
import { maskSecret } from "@/lib/maskSecret"

test("fully hides an eight character secret", () =>{
    // Doing exactly eight
    // Three statements go here
    const input = "abcdefgh"
    const actual = maskSecret(input)
    assert.strictEqual(actual, "****")
});

test("Fully hides an empty secret", () => {
    // Doing empty input
    const input = "";
    const actual = maskSecret(input)
    assert.strictEqual(actual, "****")

});

test("Hides the secrets just above the boundary", () => {
    // Doing just above the boundary
    const input = "abcdefghi";
    const actual = maskSecret(input)
    assert.strictEqual(actual, "abcd****fghi")

});
test("Hides the secret just within the boundary", () => {
    // Doing within the boundary
    const input = "abcdefg";
    const actual = maskSecret(input)
    assert.strictEqual(actual, "****")

});