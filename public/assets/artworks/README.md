# Imagens das obras

Coloque aqui as imagens das suas artes (JPG, PNG ou WEBP).

Depois, referencie cada arquivo no `src/data/artworks.json` usando o caminho a
partir da pasta `public`, comecando com barra. Exemplo:

- Arquivo: `public/assets/artworks/obra-01.jpg`
- No JSON: `"imagePath": "/assets/artworks/obra-01.jpg"`

Dicas:
- Prefira imagens com lado maximo de ~2048px para nao pesar no carregamento.
- A proporcao da imagem deve combinar com o campo `size` ([largura, altura]) da obra.
- Enquanto o arquivo nao existir, a moldura aparece como um placeholder cinza (sem quebrar a cena).
