
'use server';

import * as fs from 'fs/promises';
import path from 'path';

const configFilePath = path.join(process.cwd(), 'src', 'lib', 'config-depots.ts');

export async function getDepotConfig() {
    try {
        const fileContent = await fs.readFile(configFilePath, 'utf-8');
        
        // This is a simplified parser. It assumes the object is defined as `prefixesDepots: { [key: string]: string[] } = { ... };`
        const match = fileContent.match(/export const prefixesDepots:.* = (\{[\s\S]*?\});/);
        
        if (!match || !match[1]) {
            throw new Error("Could not parse the depot configuration object from the file.");
        }
        
        // Using Function constructor to parse the object string. It's safer than eval.
        const configObject = new Function(`return ${match[1]}`)();
        
        return { success: true, config: configObject };

    } catch (error: any) {
        console.error("Error reading depot config:", error);
        return { success: false, error: error.message };
    }
}


export async function saveDepotConfig(newConfig: { [key: string]: string[] }) {
    try {
        const currentFileContent = await fs.readFile(configFilePath, 'utf-8');

        const configObjectString = JSON.stringify(newConfig, null, 2)
           // Add a trailing comma to the last item for better git diffs
            .replace(/(\s+"[^"]+": \[[^\]]+\]\n)}/, '$1,')


        const newFileContent = currentFileContent.replace(
            /export const prefixesDepots:.* = (\{[\s\S]*?\});/,
            `export const prefixesDepots: { [key: string]: string[] } = ${configObjectString};`
        );

        if (!newFileContent.includes(`= ${configObjectString};`)) {
             throw new Error("Failed to replace the configuration block in the file.");
        }

        await fs.writeFile(configFilePath, newFileContent, 'utf-8');

        return { success: true, message: "Configuration des dépôts sauvegardée avec succès." };

    } catch (error: any) {
        console.error("Error saving depot config:", error);
        return { success: false, error: "Impossible de sauvegarder la configuration : " + error.message };
    }
}
