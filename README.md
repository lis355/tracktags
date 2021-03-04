# tracktags
JS script for music albul tags processing and convert to strong file structure (by artist and album, with cover)

```
ttag

tracktags скрипт для форматирования тэгов и структуры альбома

Options:
      --help              Помощь                                       [boolean]
  -i, --input             Папка с треками                    [string] [required]
  -o, --output            Результирующая папка               [string] [required]
      --caseArtist, --ca  Использовать заглавные буквы в имени артиста
                                                       [boolean] [default: true]
      --artist            Имя артиста                                   [string]
      --caseAlbum, --cl   Использовать заглавные буквы в имени альбома
                                                       [boolean] [default: true]
      --album             Имя альбома                                   [string]
      --caseTitle, --ct   Использовать заглавные буквы в названии трека
                                                       [boolean] [default: true]
      --genre             Жанр                                          [string]
      --year              Год                                           [number]
      --coverSize, --cs   Размер обложки (строна в пикселях, обложка квадратная)
                                                         [number] [default: 500]
      --acronyms          Акронимы, в которых не нужно менять регистр
                                     [array] [default: ["OST","EP","LP","feat"]]
```
