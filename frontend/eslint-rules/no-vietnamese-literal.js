/**
 * Chặn chữ tiếng Việt viết cứng trong code: chữ hiển thị phải nằm ở src/locales/ và gọi qua t() / i18n.t()
 * (docs/I18N_DESIGN.md §4.2). Chỉ bắt chuỗi CÓ dấu tiếng Việt — chuỗi tiếng Anh kỹ thuật (className, key,
 * mã enum...) không bị ảnh hưởng.
 *
 * Bỏ qua những chỗ chuỗi tiếng Việt là DỮ LIỆU chứ không phải chữ hiển thị (cùng luật với công cụ chuyển
 * đổi đã dùng): so sánh (===), case, đối số của console/includes/split/..., key của object, thuộc tính
 * value/id/key/code, bảng [regex, chuỗi], kiểu literal. Chỗ nào thật sự cần giữ chuỗi tiếng Việt thì
 * `// eslint-disable-next-line local/no-vietnamese-literal -- lý do`.
 */
const VI = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/

const EQUALITY = new Set(['===', '!==', '==', '!='])
const STRING_OPS = new Set(['includes', 'startsWith', 'endsWith', 'indexOf', 'lastIndexOf', 'match', 'matchAll', 'split', 'test', 'search', 'has', 'get', 'set', 'delete', 'getItem', 'setItem', 'removeItem', 'replace', 'replaceAll'])
const DATA_ATTRS = new Set(['className', 'key', 'id', 'value', 'defaultValue', 'href', 'to', 'name', 'type', 'htmlFor', 'role', 'lang', 'src', 'accept', 'autoComplete', 'inputMode', 'pattern'])
const DATA_PROPS = new Set(['value', 'id', 'key', 'code', 'dataKey', 'nameKey', 'className', 'href', 'to', 'path', 'queryKey', 'mutationKey', 'type'])

function calleeName(callee) {
  if (!callee) return ''
  if (callee.type === 'Identifier') return callee.name
  if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') return callee.property.name
  return ''
}

function isData(node) {
  let child = node
  let p = node.parent
  while (p && (p.type === 'TSAsExpression' || p.type === 'TSNonNullExpression' || p.type === 'TSSatisfiesExpression')) {
    child = p
    p = p.parent
  }
  if (!p) return false
  if (p.type === 'ImportDeclaration' || p.type === 'ExportNamedDeclaration' || p.type === 'ExportAllDeclaration') return true
  if (p.type === 'TSLiteralType' || p.type === 'TSEnumMember') return true
  if (p.type === 'Property' && p.key === child) return true
  if (p.type === 'Property' && p.value === child && !p.computed) {
    const name = p.key.type === 'Identifier' ? p.key.name : p.key.value
    if (DATA_PROPS.has(name)) return true
  }
  if (p.type === 'MemberExpression' && p.property === child) return true
  if (p.type === 'BinaryExpression' && EQUALITY.has(p.operator)) return true
  if (p.type === 'SwitchCase' && p.test === child) return true
  if ((p.type === 'CallExpression' || p.type === 'NewExpression')) {
    const callee = p.callee
    if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier' && callee.object.name === 'console') return true
    const name = calleeName(callee)
    if (name === 'RegExp') return true
    if (STRING_OPS.has(name) && p.arguments[0] === child) return true
  }
  if (p.type === 'ArrayExpression' && p.elements.some((e) => e && e.type === 'Literal' && e.regex)) return true
  if (p.type === 'JSXAttribute' || (p.type === 'JSXExpressionContainer' && p.parent?.type === 'JSXAttribute')) {
    const attr = p.type === 'JSXAttribute' ? p : p.parent
    const name = attr.name.type === 'JSXIdentifier' ? attr.name.name : ''
    if (DATA_ATTRS.has(name) || name.startsWith('data-')) return true
  }
  return false
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Không viết cứng chữ tiếng Việt — đưa vào src/locales/ và dùng t()' },
    messages: {
      viLiteral: 'Chữ tiếng Việt viết cứng "{{text}}" — đưa vào src/locales/vi/<namespace>.json (kèm bản en) và dùng t()/i18n.t(). Xem docs/I18N_DESIGN.md.',
    },
    schema: [],
  },
  create(context) {
    const report = (node, text) => {
      if (!VI.test(text) || isData(node)) return
      context.report({ node, messageId: 'viLiteral', data: { text: text.trim().slice(0, 40) } })
    }
    return {
      Literal(node) {
        if (typeof node.value === 'string') report(node, node.value)
      },
      TemplateLiteral(node) {
        report(node, node.quasis.map((q) => q.value.cooked ?? '').join(''))
      },
      JSXText(node) {
        report(node, node.value)
      },
    }
  },
}
