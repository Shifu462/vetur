import { Hover, Position, Range } from 'vscode-languageserver-types';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { LanguageMode } from '../../embeddedSupport/languageModes';
import { prettierPluginPugify } from '../../utils/prettier';
import { VLSFormatConfig } from '../../config';
import { getFileFsPath } from '../../utils/paths';
import { DependencyService } from '../../services/dependencyService';
import { getTagProviderSettings, getEnabledTagProviders } from '../template/tagProviders';
import { NULL_HOVER } from '../nullMode';
import { toMarkupContent } from '../../utils/strings';

export function getPugMode(workspacePath: string, dependencyService: DependencyService): LanguageMode {
  let config: any = {};

  const tagProviderSettings = getTagProviderSettings(workspacePath);
  const enabledTagProviders = getEnabledTagProviders(tagProviderSettings);

  function getTagHover(tag: string, range: Range): Hover {
    tag = tag.toLowerCase();
    for (const provider of enabledTagProviders) {
      let hover: Hover | null = null;
      provider.collectTags((t, documentation) => {
        if (t !== tag) {
          return;
        }
        hover = { contents: toMarkupContent(documentation), range };
      });
      if (hover) {
        return hover;
      }
    }
    return NULL_HOVER;
  }

  return {
    getId() {
      return 'pug';
    },
    configure(c) {
      config = c;
    },
    format(document, currRange, formattingOptions) {
      if (config.vetur.format.defaultFormatter['pug'] === 'none') {
        return [];
      }

      const { value, range } = getValueAndRange(document, currRange);

      return prettierPluginPugify(
        dependencyService,
        value,
        getFileFsPath(document.uri),
        range,
        config.vetur.format as VLSFormatConfig,
        // @ts-expect-error
        'pug',
        false
      );
    },
    doHover(document: TextDocument, position: Position) {
      const { token, range } = getTokenAt(document, position);

      return getTagHover(token, range);
    },
    onDocumentRemoved() {},
    dispose() {}
  };
}

function getTokenAt(document: TextDocument, pos: Position) {
  const fullText = document.getText();

  const line = fullText.split('\n')[pos.line];

  const startPos: Position = {
    line: pos.line,
    character: pos.character
  };

  while (line[startPos.character - 1] && /[a-z0-9-]/gi.test(line[startPos.character - 1])) {
    startPos.character--;
  }

  const endPos: Position = {
    line: pos.line,
    character: pos.character
  };

  while (line[endPos.character + 1] && /[a-z0-9-]/gi.test(line[endPos.character + 1])) {
    endPos.character++;
  }

  endPos.character++;

  const range: Range = {
    start: startPos,
    end: endPos
  };

  return {
    range,
    token: line.substring(startPos.character, endPos.character)
  };
}

function getValueAndRange(document: TextDocument, currRange: Range): { value: string; range: Range } {
  let value = document.getText();
  let range = currRange;

  if (currRange) {
    const startOffset = document.offsetAt(currRange.start);
    const endOffset = document.offsetAt(currRange.end);
    value = value.substring(startOffset, endOffset);
  } else {
    range = Range.create(Position.create(0, 0), document.positionAt(value.length));
  }
  return { value, range };
}
