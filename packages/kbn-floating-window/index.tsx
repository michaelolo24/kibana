/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

function copyStyles(sourceDoc: Document, targetDoc: Document) {
  Array.from(sourceDoc.styleSheets).forEach((styleSheet) => {
    if (styleSheet.cssRules) {
      // true for inline styles
      const newStyleEl = sourceDoc.createElement('style');

      Array.from(styleSheet.cssRules).forEach((cssRule) => {
        newStyleEl.appendChild(sourceDoc.createTextNode(cssRule.cssText));
      });

      targetDoc.head.appendChild(newStyleEl);
    } else if (styleSheet.href) {
      // true for stylesheets loaded from a URL
      const newLinkEl = sourceDoc.createElement('link');

      newLinkEl.rel = 'stylesheet';
      newLinkEl.href = styleSheet.href;
      targetDoc.head.appendChild(newLinkEl);
    }
  });
}

interface KibanaFloatingWindowProps {
  children: React.ReactNode;
  onCloseFloatingWindow: () => void;
  width: number;
  height: number;
  left: number;
  top: number;
  title: string;
}

export const KibanaFloatingWindow = ({
  children,
  onCloseFloatingWindow,
  width,
  height,
  left,
  top,
  title,
}: KibanaFloatingWindowProps) => {
  const externalWindowRef = useRef<Window | null>(null);
  const containerDiv = useRef(document.createElement('div'));

  const setExternalWindow = useCallback(() => {
    if (!externalWindowRef.current && children) {
      const externalWindow = window.open(
        '',
        '',
        `width=${width},height=${height},left=${left},top=${top}`
      );
      if (!externalWindow) return;

      externalWindow.document.title = title;
      externalWindow.document.body.appendChild(containerDiv.current);
      copyStyles(document, externalWindow.document);
      externalWindow.addEventListener('beforeunload', () => {
        onCloseFloatingWindow();
      });

      externalWindowRef.current = externalWindow;
    }
  }, [children, height, left, onCloseFloatingWindow, title, top, width]);

  const closeExternalWindow = useCallback(() => {
    if (externalWindowRef.current) {
      externalWindowRef.current.close();
      externalWindowRef.current = null;
    }
  }, []);

  useEffect(() => {
    setExternalWindow();
    return () => {
      closeExternalWindow();
    };
  }, [closeExternalWindow, setExternalWindow]);

  const portal = ReactDOM.createPortal(children, containerDiv.current);

  return <>{portal}</>;
};
