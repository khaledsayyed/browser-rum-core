"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startResourceCollection = void 0;
var tslib_1 = require("tslib");
var browser_core_1 = require("@datadog/browser-core");
var performanceCollection_1 = require("../../../browser/performanceCollection");
var rawRumEvent_types_1 = require("../../../rawRumEvent.types");
var lifeCycle_1 = require("../../lifeCycle");
var matchRequestTiming_1 = require("./matchRequestTiming");
var resourceUtils_1 = require("./resourceUtils");
function startResourceCollection(lifeCycle) {
    lifeCycle.subscribe(lifeCycle_1.LifeCycleEventType.REQUEST_COMPLETED, function (request) {
        lifeCycle.notify(lifeCycle_1.LifeCycleEventType.RAW_RUM_EVENT_COLLECTED, processRequest(request));
    });
    lifeCycle.subscribe(lifeCycle_1.LifeCycleEventType.PERFORMANCE_ENTRY_COLLECTED, function (entry) {
        if (entry.entryType === 'resource' && !(0, resourceUtils_1.isRequestKind)(entry)) {
            lifeCycle.notify(lifeCycle_1.LifeCycleEventType.RAW_RUM_EVENT_COLLECTED, processResourceEntry(entry));
        }
    });
}
exports.startResourceCollection = startResourceCollection;
function processRequest(request) {
    var type = request.type === browser_core_1.RequestType.XHR ? browser_core_1.ResourceType.XHR : browser_core_1.ResourceType.FETCH;
    var matchingTiming = (0, matchRequestTiming_1.matchRequestTiming)(request);
    var startClocks = matchingTiming ? (0, browser_core_1.relativeToClocks)(matchingTiming.startTime) : request.startClocks;
    var correspondingTimingOverrides = matchingTiming ? computePerformanceEntryMetrics(matchingTiming) : undefined;
    var tracingInfo = computeRequestTracingInfo(request);
    var resourceEvent = (0, browser_core_1.combine)({
        date: startClocks.timeStamp,
        resource: {
            id: (0, browser_core_1.generateUUID)(),
            type: type,
            duration: (0, browser_core_1.toServerDuration)(request.duration),
            method: request.method,
            status_code: request.status,
            url: request.url,
        },
        type: rawRumEvent_types_1.RumEventType.RESOURCE,
    }, tracingInfo, correspondingTimingOverrides);
    return {
        startTime: startClocks.relative,
        rawRumEvent: resourceEvent,
        domainContext: {
            performanceEntry: matchingTiming && toPerformanceEntryRepresentation(matchingTiming),
            xhr: request.xhr,
            response: request.response,
            requestInput: request.input,
            requestInit: request.init,
            error: request.error,
        },
    };
}
function processResourceEntry(entry) {
    var type = (0, resourceUtils_1.computeResourceKind)(entry);
    var entryMetrics = computePerformanceEntryMetrics(entry);
    var tracingInfo = computeEntryTracingInfo(entry);
    var startClocks = (0, browser_core_1.relativeToClocks)(entry.startTime);
    var resourceEvent = (0, browser_core_1.combine)({
        date: startClocks.timeStamp,
        resource: {
            id: (0, browser_core_1.generateUUID)(),
            type: type,
            url: entry.name,
        },
        type: rawRumEvent_types_1.RumEventType.RESOURCE,
    }, tracingInfo, entryMetrics);
    return {
        startTime: startClocks.relative,
        rawRumEvent: resourceEvent,
        domainContext: {
            performanceEntry: toPerformanceEntryRepresentation(entry),
        },
    };
}
function computePerformanceEntryMetrics(timing) {
    return {
        resource: (0, tslib_1.__assign)({ duration: (0, resourceUtils_1.computePerformanceResourceDuration)(timing), size: (0, resourceUtils_1.computeSize)(timing) }, (0, resourceUtils_1.computePerformanceResourceDetails)(timing)),
    };
}
function computeRequestTracingInfo(request) {
    var hasBeenTraced = request.traceId && request.spanId;
    if (!hasBeenTraced) {
        return undefined;
    }
    return {
        _dd: {
            span_id: request.spanId.toDecimalString(),
            trace_id: request.traceId.toDecimalString(),
        },
    };
}
function computeEntryTracingInfo(entry) {
    return entry.traceId ? { _dd: { trace_id: entry.traceId } } : undefined;
}
function toPerformanceEntryRepresentation(entry) {
    if ((0, performanceCollection_1.supportPerformanceEntry)() && entry instanceof PerformanceEntry) {
        entry.toJSON();
    }
    return entry;
}
//# sourceMappingURL=resourceCollection.js.map