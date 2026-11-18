import '@testing-library/jest-dom/vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach } from 'vitest';

beforeEach(() => {
  fakeBrowser.reset();
});
