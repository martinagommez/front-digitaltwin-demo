// utils/log.ts
const isDev = process.env.NODE_ENV === 'development';

export const log = (...args: any[]) => {
    if (isDev) console.log(...args);
};

export const warn = (...args: any[]) => {
    if (isDev) console.warn(...args);
};

export const error = (...args: any[]) => {
    if (isDev) console.error(...args);
};
