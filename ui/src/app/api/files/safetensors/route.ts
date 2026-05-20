import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getTrainingFolder } from '@/server/settings';

export async function GET() {
  try {
    const trainingFolder = await getTrainingFolder();
    if (!fs.existsSync(trainingFolder)) {
      return NextResponse.json({ files: [] });
    }

    const files: string[] = [];

    // Helper recursivo para listar arquivos .safetensors de maneira compatível com qualquer versão do Node
    function walkDir(dir: string) {
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (stat.isFile() && file.endsWith('.safetensors')) {
          files.push(fullPath);
        }
      }
    }

    walkDir(trainingFolder);

    const fileObjects = files.map(file => {
      const stats = fs.statSync(file);
      return {
        path: file,
        size: stats.size,
      };
    });

    return NextResponse.json({ files: fileObjects });
  } catch (error) {
    console.error('Erro ao buscar arquivos safetensors:', error);
    return NextResponse.json({ error: 'Falha ao buscar safetensors' }, { status: 500 });
  }
}
