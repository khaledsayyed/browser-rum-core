"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startRumAssembly = void 0;
var tslib_1 = require("tslib");
var browser_core_1 = require("@datadog/browser-core");
var rawRumEvent_types_1 = require("../rawRumEvent.types");
var buildEnv_1 = require("../boot/buildEnv");
var syntheticsContext_1 = require("./syntheticsContext");
var ciTestContext_1 = require("./ciTestContext");
var lifeCycle_1 = require("./lifeCycle");
var rumSessionManager_1 = require("./rumSessionManager");
var SessionType;
(function (SessionType) {
    SessionType["SYNTHETICS"] = "synthetics";
    SessionType["USER"] = "user";
    SessionType["CI_TEST"] = "ci_test";
})(SessionType || (SessionType = {}));
var VIEW_EVENTS_MODIFIABLE_FIELD_PATHS = [
    // Fields with sensitive data
    'view.url',
    'view.referrer',
    'action.target.name',
    'error.message',
    'error.stack',
    'error.resource.url',
    'resource.url',
];
var OTHER_EVENTS_MODIFIABLE_FIELD_PATHS = (0, tslib_1.__spreadArray)((0, tslib_1.__spreadArray)([], VIEW_EVENTS_MODIFIABLE_FIELD_PATHS, true), [
    // User-customizable field
    'context',
], false);
function startRumAssembly(configuration, lifeCycle, sessionManager, parentContexts, urlContexts, getCommonContext) {
    var _a;
    var reportError = function (error) {
        lifeCycle.notify(lifeCycle_1.LifeCycleEventType.RAW_ERROR_COLLECTED, { error: error });
    };
    var eventRateLimiters = (_a = {},
        _a[rawRumEvent_types_1.RumEventType.ERROR] = (0, browser_core_1.createEventRateLimiter)(rawRumEvent_types_1.RumEventType.ERROR, configuration.eventRateLimiterThreshold, reportError),
        _a[rawRumEvent_types_1.RumEventType.ACTION] = (0, browser_core_1.createEventRateLimiter)(rawRumEvent_types_1.RumEventType.ACTION, configuration.eventRateLimiterThreshold, reportError),
        _a);
    var syntheticsContext = (0, syntheticsContext_1.getSyntheticsContext)();
    var ciTestContext = (0, ciTestContext_1.getCiTestContext)();
    lifeCycle.subscribe(lifeCycle_1.LifeCycleEventType.RAW_RUM_EVENT_COLLECTED, function (_a) {
        var startTime = _a.startTime, rawRumEvent = _a.rawRumEvent, domainContext = _a.domainContext, savedCommonContext = _a.savedCommonContext, customerContext = _a.customerContext;
        var viewContext = parentContexts.findView(startTime);
        var urlContext = urlContexts.findUrl(startTime);
        // allow to send events if the session was tracked when they start
        // except for views which are continuously updated
        // TODO: stop sending view updates when session is expired
        var session = sessionManager.findTrackedSession(rawRumEvent.type !== rawRumEvent_types_1.RumEventType.VIEW ? startTime : undefined);
        if (session && viewContext && urlContext) {
            var actionContext = parentContexts.findAction(startTime);
            var commonContext = savedCommonContext || getCommonContext();
            var rumContext = {
                _dd: {
                    format_version: 2,
                    drift: (0, browser_core_1.currentDrift)(),
                    session: {
                        plan: session.hasReplayPlan ? rumSessionManager_1.RumSessionPlan.REPLAY : rumSessionManager_1.RumSessionPlan.LITE,
                    },
                    browser_sdk_version: (0, browser_core_1.canUseEventBridge)() ? buildEnv_1.buildEnv.sdkVersion : undefined,
                },
                application: {
                    id: configuration.applicationId,
                },
                date: (0, browser_core_1.timeStampNow)(),
                service: configuration.service,
                session: {
                    id: session.id,
                    type: syntheticsContext ? SessionType.SYNTHETICS : ciTestContext ? SessionType.CI_TEST : SessionType.USER,
                },
                synthetics: syntheticsContext,
                ci_test: ciTestContext,
            };
            var serverRumEvent = (needToAssembleWithAction(rawRumEvent)
                ? (0, browser_core_1.combine)(rumContext, urlContext, viewContext, actionContext, rawRumEvent)
                : (0, browser_core_1.combine)(rumContext, urlContext, viewContext, rawRumEvent));
            serverRumEvent.context = (0, browser_core_1.combine)(commonContext.context, customerContext);
            if (!('has_replay' in serverRumEvent.session)) {
                ;
                serverRumEvent.session.has_replay = commonContext.hasReplay;
            }
            if (!(0, browser_core_1.isEmptyObject)(commonContext.user)) {
                ;
                serverRumEvent.usr = commonContext.user;
            }
            if (shouldSend(serverRumEvent, configuration.beforeSend, domainContext, eventRateLimiters)) {
                if ((0, browser_core_1.isEmptyObject)(serverRumEvent.context)) {
                    delete serverRumEvent.context;
                }
                lifeCycle.notify(lifeCycle_1.LifeCycleEventType.RUM_EVENT_COLLECTED, serverRumEvent);
            }
        }
    });
}
exports.startRumAssembly = startRumAssembly;
function shouldSend(event, beforeSend, domainContext, eventRateLimiters) {
    var _a;
    if (beforeSend) {
        var result = (0, browser_core_1.limitModification)(event, event.type === rawRumEvent_types_1.RumEventType.VIEW ? VIEW_EVENTS_MODIFIABLE_FIELD_PATHS : OTHER_EVENTS_MODIFIABLE_FIELD_PATHS, function (event) { return beforeSend(event, domainContext); });
        if (result === false && event.type !== rawRumEvent_types_1.RumEventType.VIEW) {
            return false;
        }
        if (result === false) {
            browser_core_1.display.warn("Can't dismiss view events using beforeSend!");
        }
    }
    var rateLimitReached = (_a = eventRateLimiters[event.type]) === null || _a === void 0 ? void 0 : _a.isLimitReached();
    return !rateLimitReached;
}
function needToAssembleWithAction(event) {
    return [rawRumEvent_types_1.RumEventType.ERROR, rawRumEvent_types_1.RumEventType.RESOURCE, rawRumEvent_types_1.RumEventType.LONG_TASK].indexOf(event.type) !== -1;
}
//# sourceMappingURL=assembly.js.map