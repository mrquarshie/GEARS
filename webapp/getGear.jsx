import { renderToString } from 'react-dom/server';
import { Gear } from '@phosphor-icons/react';
import React from 'react';

console.log(renderToString(React.createElement(Gear, { size: 48, weight: 'bold' })));
