"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_INTEGRATION_CONFIG = void 0;
exports.DEFAULT_INTEGRATION_CONFIG = {
    contacts: {
        enabled: false,
    },
    calendar: {
        enabled: false,
        sources: ['apple'],
    },
    email: {
        enabled: false,
        provider: null,
    },
    files: {
        enabled: false,
        watchedFolders: [],
    },
};
