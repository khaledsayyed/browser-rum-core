export interface CiTestWindow extends Window {
    Cypress?: {
        env: (key: string) => string | undefined;
    };
}
export declare function getCiTestContext(): {
    test_execution_id: string;
} | undefined;
