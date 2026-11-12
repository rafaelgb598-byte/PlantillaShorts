// Configuración de Remotion Studio (npm run estudio). Los scripts de render pasan sus opciones directamente.
import { Config } from "@remotion/cli/config";

Config.setEntryPoint("estilos/index.ts");
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("angle");
