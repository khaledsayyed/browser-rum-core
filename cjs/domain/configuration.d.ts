import { Configuration, DefaultPrivacyLevel, InitConfiguration } from '@datadog/browser-core';
import { RumEventDomainContext } from '../domainContext.types';
import { RumEvent } from '../rumEvent.types';
export interface RumInitConfiguration extends InitConfiguration {
    applicationId: string;
    beforeSend?: ((event: RumEvent, context: RumEventDomainContext) => void | boolean) | undefined;
    allowedTracingOrigins?: ReadonlyArray<string | RegExp> | undefined;
    defaultPrivacyLevel?: DefaultPrivacyLevel | undefined;
    replaySampleRate?: number | undefined;
    trackInteractions?: boolean | undefined;
    actionNameAttribute?: string | undefined;
    trackViewsManually?: boolean | undefined;
}
export declare type HybridInitConfiguration = Omit<RumInitConfiguration, 'applicationId' | 'clientToken'>;
export interface RumConfiguration extends Configuration {
    actionNameAttribute: string | undefined;
    allowedTracingOrigins: Array<string | RegExp>;
    applicationId: string;
    defaultPrivacyLevel: DefaultPrivacyLevel;
    replaySampleRate: number;
    trackInteractions: boolean;
    trackViewsManually: boolean;
}
export declare function validateAndBuildRumConfiguration(initConfiguration: RumInitConfiguration): RumConfiguration | undefined;
