const authKey = 'notthatsecret';
const retryDelay = 5000;

// ws keeps a small state to help with reconnecting
let params = {
    userId: null,
    taskId: null
};
let ws;
let reconnectTimer;
let lastUrl;
let saveError = false;

/**
 * @returns {boolean} Whether the websocket is open and ready
 */
const isOpen = function () {
    if (!ws) return false;
    return ws.readyState === WebSocket.OPEN;
};

/**
 * @returns {boolean} Whether websocket is currently trying to reconnect
 */
const isReconnecting = function () {
    if (reconnectTimer) return true
    return false
};

/**
 * Stores whether or not the last response from the logging endpoint reported a save error.
 * @returns {boolean} Last response had a save error
 */
const hasSaveError = function () {
    return (saveError);
};
/**
 * Sends a String over the websocket
 * @param {string} message The String to send
 * @returns {boolean} True if message was sent, else false
 */
const sendString = function (message) {
    if (!isOpen()) return false;
    ws.send(message);
    return isOpen();
};

/**
 * Sends user actions over the websocket
 * @param {[object]} actions Array of user action objects
 * @returns {boolean} True if message was sent, else false
 */
const sendActions = function (actions) {
    if (!isOpen()) return false;
    const payload = {};
    payload.authKey = authKey;
    payload.userActions = actions;
    ws.send(JSON.stringify(payload));
    // Simple isOpen check to see if message was (probably) sent.
    // Possible to implement awaiting response here instead.
    return isOpen();
};

/**
 * React to messages / responses from the logging endpoint
 * @param msg Message that's hopefully from the logging endpoint
 */
const handleResponse = function (msg) {
    try {
        msg = JSON.parse(msg);
    } catch (e) {
        console.log('message received was not valid JSON');
        return;
    }
    if (typeof msg != 'object') return
    if ('success' in msg) {
        saveError = !msg.success;
        if (saveError) console.log(`Actions not saved on endpoint: ${msg.error}`);
    }
    if ('newUserId' in msg) {
        params.userId = msg.newUserId;
    }

};

/**
 * Creates new ws connection to logging endpoint, automatically reconnects on close.
 * Doesn't change or redo an existing open connection.
 * Remembers url param if given once.
 */
const connectWebSocket = function (url) {
    clearInterval(reconnectTimer); // Stop reconnect
    reconnectTimer = null;
    if (isOpen()) return; // Don't reconnect healthy connection

    if (url) {
        lastUrl = url; // Save url to lastUrl
    } else {
        url = lastUrl; // Get last url
    }
    if (!url) return; // No url to connect to

    _setParamsFromUrl();
    let firstParam = true
    if (params.userId) {
        url += `/?userId=${params.userId}`
        firstParam = false
    }
    if (params.taskId) {
        url += (firstParam) ? '/?' : '&' // use & if not first param
        url += `taskId=${params.taskId}`
    }
    ws = new window.WebSocket(url);

    ws.onopen = function () {
        console.log('WebSocket Connected');
    };

    ws.onmessage = function (ev) {
        console.log(`Received ws message: ${ev.data}`);
        handleResponse(ev.data);
    };

    ws.onerror = function (ev) {
        console.error('WebSocket error:', ev);
    };

    ws.onclose = function (ev) {
        console.log(`Websocket closed: ${ev.code}  ${ev.reason}`);
        // Retry
        if (!reconnectTimer) {
            console.log(`retrying websocket connection in ${retryDelay}ms`);
            reconnectTimer = setTimeout(connectWebSocket, retryDelay);
        }
    };
};

/**
 * Resets the state of this module. Currently only used for tests.
 * It keeps a small state to help with reconnecting, could be refactored to store elsewhere or in cookie.
 */
const resetState = function () {
    params = {
        userId: null,
        taskId: null
    }
    // if (ws && typeof ws.terminate === 'function') ws.terminate()
    ws = undefined; // Clear WebSocket
    if (reconnectTimer) clearInterval(reconnectTimer);
    reconnectTimer = null;
    lastUrl = null;
    saveError = false;
};

/**
 * @returns {String | null} userId
 */
const getUserId = function () {
    return params.userId;
};

/**
 * @returns {String | null} taskId
 */
const getTaskId = function () {
    return params.taskId;
};

const _setParamsFromUrl = function () {
    // Get userId and taskId from url
    const url = new URL(window.location.href);
    // Replace only if not null
    const userIdFromUrl = url?.searchParams.get('user');
    if (userIdFromUrl) params.userId = userIdFromUrl;
    const taskIdFromUrl = url?.searchParams.get('task');
    if (taskIdFromUrl) params.taskId = taskIdFromUrl;
};

module.exports = {
    connectWebSocket: connectWebSocket,
    sendActions: sendActions,
    sendString: sendString,
    isOpen: isOpen,
    isReconnecting: isReconnecting,
    hasSaveError: hasSaveError,
    resetState: resetState,
    getUserId: getUserId,
    getTaskId: getTaskId
};
