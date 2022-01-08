export function getCiTestContext() {
    var _a;
    var testExecutionId = (_a = window.Cypress) === null || _a === void 0 ? void 0 : _a.env('traceId');
    if (typeof testExecutionId === 'string') {
        return {
            test_execution_id: testExecutionId,
        };
    }
}
//# sourceMappingURL=ciTestContext.js.map