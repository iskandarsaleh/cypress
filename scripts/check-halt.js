/* eslint-disable no-console */
const execa = require('execa')
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

const containsBinaryOther = async () => {
  // the files that we want to rerun tests for that exist outside of lerna packages
  const binaryFiles = [
    '.node-version',
    'electron-builder.json',
    'package.json',
    'yarn.lock',
  ]

  const changedFiles = await getChangedFiles()

  return !!changedFiles.find((f) => f.includes('scripts/') || binaryFiles.includes(f))
}

const main = async () => {
  const { stdout: currentBranch } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'])

  if (currentBranch === 'develop' || currentBranch === 'master') {
    console.log(`Currently on ${currentBranch} - all tests run`)
    runTests()
  }

  const changed = await getChangedPackages()

  if (containsBinaryPackage(changed) || await containsBinaryOther()) {
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
