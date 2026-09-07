import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        primary: { value: '#5100FF' },
        secondary: { value: '#916ED8' },
        accentBg: { value: '#F7F6FF' },
        accentSoft: { value: '#DBCDFF' },
        ink: { value: '#000000' },
        grayText: { value: '#585858' },
        grayLight: { value: '#CECECE' },
        border: { value: '#E9E9E9' },
        success: { value: '#12AC64' },
        successBg: { value: '#D9FFED' },
        danger: { value: '#FF4C4C' },
        dangerBg: { value: '#FFD0D0' },
        warning: { value: '#DA9705' },
        warningBg: { value: '#FFEDCA' },
        info: { value: '#52A0EE' },
        infoBg: { value: '#DBEDFF' },
      },
      fonts: {
        body: { value: 'Inter, system-ui, sans-serif' },
        heading: { value: 'Inter, system-ui, sans-serif' },
      },
      radii: {
        sm: { value: '4px' },
        md: { value: '8px' },
        lg: { value: '12px' },
        full: { value: '999px' },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);

export const DIV = {
  primary: '#5100FF',
  secondary: '#916ED8',
  accentBg: '#F7F6FF',
  accentSoft: '#DBCDFF',
  ink: '#000000',
  gray: '#585858',
  grayLight: '#CECECE',
  border: '#E9E9E9',
  success: '#12AC64',
  successBg: '#D9FFED',
  danger: '#FF4C4C',
  dangerBg: '#FFD0D0',
  warning: '#DA9705',
  warningBg: '#FFEDCA',
  info: '#52A0EE',
  infoBg: '#DBEDFF',
} as const;
