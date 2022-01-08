"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeRumPublicApi = void 0;
var tslib_1 = require("tslib");
var browser_core_1 = require("@datadog/browser-core");
var rawRumEvent_types_1 = require("../rawRumEvent.types");
var syntheticsContext_1 = require("../domain/syntheticsContext");
var configuration_1 = require("../domain/configuration");
function makeRumPublicApi(startRumImpl, recorderApi, _a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.ignoreInitIfSyntheticsWillInjectRum, ignoreInitIfSyntheticsWillInjectRum = _c === void 0 ? true : _c;
    var isAlreadyInitialized = false;
    var globalContextManager = (0, browser_core_1.createContextManager)();
    var user = {};
    var getInternalContextStrategy = function () { return undefined; };
    var getInitConfigurationStrategy = function () { return undefined; };
    var bufferApiCalls = new browser_core_1.BoundedBuffer();
    var addTimingStrategy = function (name, time) {
        if (time === void 0) { time = (0, browser_core_1.timeStampNow)(); }
        bufferApiCalls.add(function () { return addTimingStrategy(name, time); });
    };
    var startViewStrategy = function (name, startClocks) {
        if (startClocks === void 0) { startClocks = (0, browser_core_1.clocksNow)(); }
        bufferApiCalls.add(function () { return startViewStrategy(name, startClocks); });
    };
    var addActionStrategy = function (action, commonContext) {
        if (commonContext === void 0) { commonContext = clonedCommonContext(); }
        bufferApiCalls.add(function () { return addActionStrategy(action, commonContext); });
    };
    var addErrorStrategy = function (providedError, commonContext) {
        if (commonContext === void 0) { commonContext = clonedCommonContext(); }
        bufferApiCalls.add(function () { return addErrorStrategy(providedError, commonContext); });
    };
    var stopViewStrategy = function () {
        bufferApiCalls.add(function () { return stopViewStrategy(); });
    };
    function clonedCommonContext() {
        return (0, browser_core_1.deepClone)({
            context: globalContextManager.get(),
            user: user,
        });
    }
    function initRum(initConfiguration) {
        // If we are in a Synthetics test configured to automatically inject a RUM instance, we want to
        // completely discard the customer application RUM instance by ignoring their init() call.  But,
        // we should not ignore the init() call from the Synthetics-injected RUM instance, so the
        // internal `ignoreInitIfSyntheticsWillInjectRum` option is here to bypass this condition.
        if (ignoreInitIfSyntheticsWillInjectRum && (0, syntheticsContext_1.willSyntheticsInjectRum)()) {
            return;
        }
        if ((0, browser_core_1.canUseEventBridge)()) {
            initConfiguration = overrideInitConfigurationForBridge(initConfiguration);
        }
        else if (!canHandleSession(initConfiguration)) {
            return;
        }
        if (!canInitRum(initConfiguration)) {
            return;
        }
        var configuration = (0, configuration_1.validateAndBuildRumConfiguration)(initConfiguration);
        if (!configuration) {
            return;
        }
        var internalMonitoring = (0, browser_core_1.startInternalMonitoring)(configuration);
        if (!configuration.trackViewsManually) {
            doStartRum(configuration, internalMonitoring);
        }
        else {
            // drain beforeInitCalls by buffering them until we start RUM
            // if we get a startView, drain re-buffered calls before continuing to drain beforeInitCalls
            // in order to ensure that calls are processed in order
            var beforeInitCalls = bufferApiCalls;
            bufferApiCalls = new browser_core_1.BoundedBuffer();
            startViewStrategy = function (name) {
                doStartRum(configuration, internalMonitoring, name);
            };
            beforeInitCalls.drain();
        }
        getInitConfigurationStrategy = function () { return (0, browser_core_1.deepClone)(initConfiguration); };
        isAlreadyInitialized = true;
    }
    function doStartRum(configuration, internalMonitoring, initialViewName) {
        var startRumResults = startRumImpl(configuration, internalMonitoring, function () { return ({
            user: user,
            context: globalContextManager.get(),
            hasReplay: recorderApi.isRecording() ? true : undefined,
        }); }, recorderApi, initialViewName);
        (startViewStrategy = startRumResults.startView, stopViewStrategy = startRumResults.stopView, addActionStrategy = startRumResults.addAction, addErrorStrategy = startRumResults.addError, addTimingStrategy = startRumResults.addTiming, getInternalContextStrategy = startRumResults.getInternalContext);
        bufferApiCalls.drain();
        recorderApi.onRumStart(startRumResults.lifeCycle, configuration, startRumResults.session, startRumResults.parentContexts);
    }
    var rumPublicApi = (0, browser_core_1.makePublicApi)({
        init: (0, browser_core_1.monitor)(initRum),
        addRumGlobalContext: (0, browser_core_1.monitor)(globalContextManager.add),
        removeRumGlobalContext: (0, browser_core_1.monitor)(globalContextManager.remove),
        getRumGlobalContext: (0, browser_core_1.monitor)(globalContextManager.get),
        setRumGlobalContext: (0, browser_core_1.monitor)(globalContextManager.set),
        getInternalContext: (0, browser_core_1.monitor)(function (startTime) { return getInternalContextStrategy(startTime); }),
        getInitConfiguration: (0, browser_core_1.monitor)(function () { return getInitConfigurationStrategy(); }),
        addAction: (0, browser_core_1.monitor)(function (name, context) {
            addActionStrategy({
                name: name,
                context: (0, browser_core_1.deepClone)(context),
                startClocks: (0, browser_core_1.clocksNow)(),
                type: rawRumEvent_types_1.ActionType.CUSTOM,
            });
        }),
        addError: function (error, context) {
            var handlingStack = (0, browser_core_1.createHandlingStack)();
            (0, browser_core_1.callMonitored)(function () {
                addErrorStrategy({
                    error: error,
                    handlingStack: handlingStack,
                    context: (0, browser_core_1.deepClone)(context),
                    startClocks: (0, browser_core_1.clocksNow)(),
                });
            });
        },
        addTiming: (0, browser_core_1.monitor)(function (name, time) {
            addTimingStrategy(name, time);
        }),
        setUser: (0, browser_core_1.monitor)(function (newUser) {
            var sanitizedUser = sanitizeUser(newUser);
            if (sanitizedUser) {
                user = sanitizedUser;
            }
            else {
                browser_core_1.display.error('Unsupported user:', newUser);
            }
        }),
        removeUser: (0, browser_core_1.monitor)(function () {
            user = {};
        }),
        startView: (0, browser_core_1.monitor)(function (name) {
            startViewStrategy(name);
        }),
        stopView: (0, browser_core_1.monitor)(function () { stopViewStrategy(); }),
        startSessionReplayRecording: (0, browser_core_1.monitor)(recorderApi.start),
        stopSessionReplayRecording: (0, browser_core_1.monitor)(recorderApi.stop),
    });
    return rumPublicApi;
    function sanitizeUser(newUser) {
        if (typeof newUser !== 'object' || !newUser) {
            return;
        }
        var result = (0, browser_core_1.deepClone)(newUser);
        if ('id' in result) {
            result.id = String(result.id);
        }
        if ('name' in result) {
            result.name = String(result.name);
        }
        if ('email' in result) {
            result.email = String(result.email);
        }
        return result;
    }
    function canHandleSession(initConfiguration) {
        if (!(0, browser_core_1.areCookiesAuthorized)((0, browser_core_1.buildCookieOptions)(initConfiguration))) {
            browser_core_1.display.warn('Cookies are not authorized, we will not send any data.');
            return false;
        }
        if (isLocalFile()) {
            browser_core_1.display.error('Execution is not allowed in the current context.');
            return false;
        }
        return true;
    }
    function canInitRum(initConfiguration) {
        if (isAlreadyInitialized) {
            if (!initConfiguration.silentMultipleInit) {
                browser_core_1.display.error('DD_RUM is already initialized.');
            }
            return false;
        }
        return true;
    }
    function overrideInitConfigurationForBridge(initConfiguration) {
        return (0, tslib_1.__assign)((0, tslib_1.__assign)({}, initConfiguration), { applicationId: 'empty', clientToken: 'empty', sampleRate: 100 });
    }
    function isLocalFile() {
        return window.location.protocol === 'file:';
    }
}
exports.makeRumPublicApi = makeRumPublicApi;
//# sourceMappingURL=rumPublicApi.js.map