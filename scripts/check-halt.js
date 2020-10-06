/* eslint-disable no-console */
const execa = require('execa')
const got = require('got')
const argv = require('minimist')(process.argv.slice(2))

const { getChangedFiles, getChangedPackages } = require('./changed-packages')

const pack = argv._[0]

const runTests = () => {
  process.exit(0)
}

const skipTests = () => {
  process.exit(1)
}

const containsBinaryPackage = (changes) => {
  return !!changes.find((name) => name === 'cypress' || name.includes('@packages'))
}

const containsBinaryOther = async (branch) => {
  // the files that we want to rerun tests for that exist outside of lerna packages
  const binaryFiles = [
    '.node-version',
    'electron-builder.json',
    'package.json',
    'yarn.lock',
  ]

  const changedFiles = await getChangedFiles(branch)

  return !!changedFiles.find((f) => f.includes('scripts/') || binaryFiles.includes(f))
}

const fetchBranch = async (branch) => {
  return execa('git', ['fetch', 'origin', `${branch}:${branch}`])
}

const getPRBase = async () => {
  try {
    const pr = process.env.CIRCLE_PULL_REQUEST.match(/\d+/)[0]

    const response = await got.get(`https://api.github.com/repos/cypress-io/cypress/pulls/${pr}`, { responseType: 'json' })

    return response.body.base.ref
  } catch (e) {
    return null
  }
}

const findBase = async () => {
  // if we know there is a PR, find it's base
  if (process.env.CIRCLE_PULL_REQUEST) {
    const prBase = await getPRBase()

    if (prBase) {
      if (prBase !== 'develop') {
        // pull down pr base branch
        await fetchBranch(prBase)
      }

      return prBase
    }
  }

  // we don't know exactly what to compare to here without PR info
  // so we just default to develop since "git merge-base" used in changed-packages
  // will find where the branches diverged
  // and since develop should always be fast-forward of master it'll work for any branches off master

  return 'develop'
}

const main = async () => {
  const { stdout: currentBranch } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'])

  if (currentBranch === 'develop' || currentBranch === 'master') {
    console.log(`Currently on ${currentBranch} - all tests run`)
    runTests()
  }

  const base = await findBase(currentBranch)
  const changed = await getChangedPackages(base)

  if (containsBinaryPackage(changed) || await containsBinaryOther(base)) {
    console.log(`Binary was changed - all tests run`)
    runTests()
  }

  if (pack) {
    if (changed.includes(pack)) {
      console.log(`${pack} was changed, tests run`)
      runTests()
    }

    console.log(`${pack} and the binary are unchanged, so skip tests`)
    skipTests()
  }

  console.log(`The binary is unchanged, so skip tests`)
  skipTests()
}

main()
