const ConfigChain = require('../config-chain')
const resolvePackage = require('../utils/resolvePackage')

function renderMarkdown(api, page) {
  const { configDir } = api
  const { markdown = {} } = api.config
  const env = {
    Token: require('saber-markdown').Token,
    filePath: page.internal.absolute,
    pagesDir: api.resolveCwd('pages'),
    page
  }

  const chain = new ConfigChain()

  chain.options.merge(
    Object.assign(
      {
        html: true,
        linkify: true,
        highlight: markdown.highlighter
      },
      markdown.options
    )
  )

  const builtInPlugins = [
    {
      name: 'hoist-tags',
      resolve: require.resolve('../markdown/hoist-tags-plugin')
    },
    {
      name: 'excerpt',
      resolve: require.resolve('../markdown/excerpt-plugin')
    },
    {
      name: 'escape-interpolations',
      resolve: require.resolve('../markdown/escape-interpolations-plugin')
    },
    {
      name: 'headings',
      resolve: require.resolve('../markdown/headings-plugin'),
      options: {
        ...(markdown.headings || {}),
        slugify:
          markdown.slugify &&
          require(resolvePackage(markdown.slugify, { cwd: configDir }))
      }
    },
    {
      name: 'highlight',
      resolve: require.resolve('../markdown/highlight-plugin'),
      options: {
        lineNumbers: markdown.lineNumbers
      }
    },
    {
      name: 'task-list',
      resolve: require.resolve('../markdown/task-list-plugin')
    }
  ]

  // Load built-in plugins
  chain.loadPlugins(builtInPlugins, configDir)

  api.hooks.chainMarkdown.call(chain)

  // Load plugins from config file
  if (markdown.plugins) {
    chain.loadPlugins(markdown.plugins, configDir)
  }

  const { options, plugins } = chain.toConfig()

  if (typeof options.highlight === 'string') {
    options.highlight = require(resolvePackage(options.highlight, {
      cwd: configDir,
      prefix: 'saber-highlighter-'
    }))
  }

  const md = require('saber-markdown')(options)

  for (const plugin of plugins) {
    md.use(plugin.plugin, ...plugin.args)
  }

  return md.render(page.content, env)
}

exports.name = 'builtin:transformer-markdown'

exports.apply = api => {
  api.transformers.add('markdown', {
    extensions: ['md'],
    transform(page) {
      const { frontmatter, body } = require('../utils/parseFrontmatter')(
        page.content,
        page.internal.absolute
      )
      Object.assign(page, frontmatter)
      page.content = body
      page.content = renderMarkdown(api, page)
    },
    getPageComponent(page) {
      return `
        <template>
        <layout-manager>
          ${page.content || ''}
        </layout-manager>
        </template>
      `
    }
  })
}
