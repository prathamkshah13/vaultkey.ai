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


//Github personal access token tests
test("Positive test for the github personal access toke", () => {
    const input = "hello\nghp_abcdefghij01234567890123456789abcdef"
    const actual = scanForSecrets(input)
    assert.strictEqual(actual.length, 1);
    assert.strictEqual(actual[0].provider, "github")
    assert.strictEqual(actual[0].lineNumber, 2)
    assert.strictEqual(actual[0].maskedValue, "ghp_****cdef")
})

test("Negative test for the github personal access toke", () => {
    const input = "ghp_short"
    const actual = scanForSecrets(input)
    assert.deepStrictEqual(actual, []);
})

test("Positive test for the github fine-grained personal access token", () => {
    const fineGrainedSuffix = "abcdefghij".repeat(8) + "kl"; // 82 chars, matches GitHub's documented fine-grained PAT body length
    const input = `hello\ngithub_pat_${fineGrainedSuffix}`
    const actual = scanForSecrets(input)
    assert.strictEqual(actual.length, 1);
    assert.strictEqual(actual[0].provider, "github")
    assert.strictEqual(actual[0].lineNumber, 2)
    assert.strictEqual(actual[0].maskedValue, "gith****ijkl")
})

test("Negative test for the github fine-grained personal access token (correct prefix, too short)", () => {
    const input = "github_pat_abcde"
    const actual = scanForSecrets(input)
    assert.deepStrictEqual(actual, []);
})

// Shared fake fixtures reused by the new-format tests below. All values are synthetic and
// sized to match each provider's documented/community-standard body length.
const fake36 = "abcdefghij".repeat(3) + "abcdef"; // 36 chars, ends "...cdef"
const fake24 = "abcdefghijklmnopqrstuvwx";          // 24 chars, ends "...uvwx"
const fake35 = "abcdefghijklmnopqrstuvwxyz012345678"; // 35 chars, ends "...5678"
const slackSecret24 = "AbCdEfGhIjKlMnOpQrStUvWx";    // 24 chars, ends "...UvWx"

test("Positive test for the github OAuth access token (gho_)", () => {
    const input = `hello\ngho_${fake36}`
    const actual = scanForSecrets(input)
    assert.strictEqual(actual.length, 1);
    assert.strictEqual(actual[0].provider, "github")
    assert.strictEqual(actual[0].lineNumber, 2)
    assert.strictEqual(actual[0].maskedValue, "gho_****cdef")
})

test("Negative test for the github OAuth access token (gho_, too short)", () => {
    const input = "gho_short"
    const actual = scanForSecrets(input)
    assert.deepStrictEqual(actual, []);
})

test("Positive test for the github user-to-server token (ghu_)", () => {
    const input = `hello\nghu_${fake36}`
    const actual = scanForSecrets(input)
    assert.strictEqual(actual.length, 1);
    assert.strictEqual(actual[0].provider, "github")
    assert.strictEqual(actual[0].lineNumber, 2)
    assert.strictEqual(actual[0].maskedValue, "ghu_****cdef")
})

test("Negative test for the github user-to-server token (ghu_, too short)", () => {
    const input = "ghu_short"
    const actual = scanForSecrets(input)
    assert.deepStrictEqual(actual, []);
})

test("Positive test for the github refresh token (ghr_)", () => {
    const input = `hello\nghr_${fake36}`
    const actual = scanForSecrets(input)
    assert.strictEqual(actual.length, 1);
    assert.strictEqual(actual[0].provider, "github")
    assert.strictEqual(actual[0].lineNumber, 2)
    assert.strictEqual(actual[0].maskedValue, "ghr_****cdef")
})

test("Negative test for the github refresh token (ghr_, too short)", () => {
    const input = "ghr_short"
    const actual = scanForSecrets(input)
    assert.deepStrictEqual(actual, []);
})

test("Positive test for the Stripe live secret key (sk_live_)", () => {
    const input = `hello\nsk_live_${fake24}`
    const actual = scanForSecrets(input)
    assert.strictEqual(actual.length, 1);
    assert.strictEqual(actual[0].provider, "stripe")
    assert.strictEqual(actual[0].lineNumber, 2)
    assert.strictEqual(actual[0].maskedValue, "sk_l****uvwx")
})

test("Negative test for the Stripe live secret key (sk_live_, too short)", () => {
    const input = "sk_live_short"
    const actual = scanForSecrets(input)
    assert.deepStrictEqual(actual, []);
})

test("Positive test for the Stripe test secret key (sk_test_)", () => {
    const input = `hello\nsk_test_${fake24}`
    const actual = scanForSecrets(input)
    assert.strictEqual(actual.length, 1);
    assert.strictEqual(actual[0].provider, "stripe")
    assert.strictEqual(actual[0].lineNumber, 2)
    assert.strictEqual(actual[0].maskedValue, "sk_t****uvwx")
})

test("Negative test for the Stripe test secret key (sk_test_, too short)", () => {
    const input = "sk_test_short"
    const actual = scanForSecrets(input)
    assert.deepStrictEqual(actual, []);
})

test("Positive test for the Slack bot token (xoxb-)", () => {
    const input = `hello\nxoxb-1234567890123-1234567890123-${slackSecret24}`
    const actual = scanForSecrets(input)
    assert.strictEqual(actual.length, 1);
    assert.strictEqual(actual[0].provider, "slack")
    assert.strictEqual(actual[0].lineNumber, 2)
    assert.strictEqual(actual[0].maskedValue, "xoxb****UvWx")
})

test("Negative test for the Slack bot token (xoxb-, near-miss secret segment too short)", () => {
    const input = "xoxb-123-456-short"
    const actual = scanForSecrets(input)
    assert.deepStrictEqual(actual, []);
})

test("Positive test for the Google/Gemini API key (AIza)", () => {
    const input = `hello\nAIza${fake35}`
    const actual = scanForSecrets(input)
    assert.strictEqual(actual.length, 1);
    assert.strictEqual(actual[0].provider, "google")
    assert.strictEqual(actual[0].lineNumber, 2)
    assert.strictEqual(actual[0].maskedValue, "AIza****5678")
})

test("Negative test for the Google/Gemini API key (AIza, too short)", () => {
    const input = "AIzaShort"
    const actual = scanForSecrets(input)
    assert.deepStrictEqual(actual, []);
})

test("Positive test for the npm access token (npm_)", () => {
    const input = `hello\nnpm_${fake36}`
    const actual = scanForSecrets(input)
    assert.strictEqual(actual.length, 1);
    assert.strictEqual(actual[0].provider, "npm")
    assert.strictEqual(actual[0].lineNumber, 2)
    assert.strictEqual(actual[0].maskedValue, "npm_****cdef")
})

test("Negative test for the npm access token (npm_, too short)", () => {
    const input = "npm_short"
    const actual = scanForSecrets(input)
    assert.deepStrictEqual(actual, []);
})

test("orders mixed new-format findings by source position and reports no duplicate or overlapping matches", () => {
    const stripeTestKey = `sk_test_${fake24}`;
    const slackToken = `xoxb-1234567890123-1234567890123-${slackSecret24}`;
    const githubOAuth = `gho_${fake36}`;
    const githubUserToServer = `ghu_${fake36}`;

    const input = `${stripeTestKey}\n${slackToken}\n${githubOAuth} ${githubUserToServer}`;

    const actual = scanForSecrets(input);

    // Exactly 4 findings confirms none of the new patterns double-matched each other
    // (e.g. a github token's own "gh*_" prefix being re-caught by a different detector).
    assert.strictEqual(actual.length, 4);

    assert.strictEqual(actual[0].provider, "stripe");
    assert.strictEqual(actual[0].lineNumber, 1);

    assert.strictEqual(actual[1].provider, "slack");
    assert.strictEqual(actual[1].lineNumber, 2);

    assert.strictEqual(actual[2].provider, "github");
    assert.strictEqual(actual[2].maskedValue, "gho_****cdef");
    assert.strictEqual(actual[2].lineNumber, 3);

    assert.strictEqual(actual[3].provider, "github");
    assert.strictEqual(actual[3].maskedValue, "ghu_****cdef");
    assert.strictEqual(actual[3].lineNumber, 3);
});


