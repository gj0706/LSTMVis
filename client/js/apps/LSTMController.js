/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 1/25/17.
 */
class LSTMController {

    static get events() {
        return {
            wrongParameters: 'lstmcontroller_wrongParams',
            contextRequestSent: 'lstmcontrol_ctxreq',
            newContextAvailable: 'lstmcontrol_newctx',
            newMatchingResults: 'lstmcontrol_newmatch',
            newWordSearchResults: 'lstmcontrol_newwordsearchRes',
            windowResize: 'lestmcontrol_wres',
            projectsMetaAvailable: 'lstmcontrol_metaav'
        }
    }

    /**
     * Parameters not visible in URL
     * @returns {Set} the set of params
     */
    static get hiddenParams() {
        return new Set(['dims', 'transform', 'left', 'right'])
    }


    constructor({eventHandler}) {
        this.apiURL = URLHandler.basicURL() + '/api/v2'; // returns "http://0.0.0.0:8080/api/v2"
        this.eventHandler = eventHandler;
        this.state = {};
        this.colorManager = new ColorManager({});

        // Throttling to stay responsive
        this.updateURLparams = _.throttle(this._updateURLparams, 300);


        this.params = URLHandler.parameters(); // golobal_helper.js 97: returns {Map} the url parameters as a key-value store (ES6 map)
        this._setDefaults(this.params);// add default key,value parameter pairs to map
        this.updateURLparams();

        window.onresize = () =>
          this.eventHandler.trigger(LSTMController.events.windowResize, {})


    }

    newLinkString({overwrite = {}, ignore = []}) {
        const ignoreSet = new Set(ignore);
        const validParams = new Map([...this.params]
          .filter(d => !(LSTMController.hiddenParams.has(d[0]) || ignoreSet.has(d[0]))));


        Object.keys(overwrite).forEach(key => validParams.set(key, overwrite[key]));

        return URLHandler.urlString(validParams);

    }

    _updateURLparams() {
        const validParams = new Map([...this.params]
          .filter(d => !LSTMController.hiddenParams.has(d[0])));


        URLHandler.updateUrl({
            urlParameters: validParams,
            addToBrowserHistory: false
        })

    }

    initByUrlAndRun() {
        const params = this.params; // this.params = URLHandler.parameters(); golobal_helper.js 97: returns {Map} the url parameters as a key-value store (ES6 map)
        /**
         eg. params: Map(12)
         [[Entries]]
         0: {"project" => "05childbook"}
         1: {"source" => "states::states1"}
         2: {"activation" => 0.3}
         3: {"cw" => 30}
         4: {"meta" => Array(2)}
         key: "meta"
         value: (2) ["named_entity", "part_of_speech"]
         5: {"pos" => 100}
         6: {"wordBrush" => Array(2)}
         7: {"wordBrushZero" => Array(2)}
         key: "wordBrushZero"
         value: (2) [1, 0]
         8: {"sc" => Array(8)}
         key: "sc"
         value: (8) [5, 14, 26, 32, 92, 104, 145, 195]
         9: {"left" => 3}
         10: {"right" => 20}
         11: {"dims" => Array(2)}
         key: "dims"
         value: Array(2)
         0: "states"
         1: "words"
         length: 2
         __proto__: Array(0)
         size: (...)
         __proto__: Map
         */
        if (
          params.has('project') &&
          params.has('source')) {
            // this.apiURL: "http://0.0.0.0:8080/api/v2" request data from api
            Network.ajax_request(this.apiURL + '/info') // eg. "http://0.0.0.0:8080/api/v2/info"
              .get()
              .then(response => {
                  const allProjects = JSON.parse(response); // parse fetched data into json format
                  this.allProjectInfos = new Map();
                  allProjects.forEach(d => this.allProjectInfos.set(d.project, d))
                  /**
                   allProjects:
                   (2) [{…}, {…}]
                   0: {info: {…}, project: "05childbook"}

                   1: {info: {…}, project: "parens"}
                   length: 2
                   __proto__: Array(0)
                    */
                  // Register the known dimensions to color manager
                  this.colorManager.reset();
                  this.projectMetas.forEach(meta => {
                      if (meta.type === 'discrete') {
                          this.colorManager.registerCategoricalDim(meta.key, meta.range);
                      }
                  });
                  /**
                   * this.projectMetas
                   (2) [{…}, {…}]
                   0:
                   key: "named_entity"
                   type: "discrete"
                   range: (17) ["ORDINAL", "LOC", "PRODUCT", "NORP", "WORK_OF_ART", "LANGUAGE", "GPE", "TIME", "O", "PERSON", "CARDINAL", "MONEY", "DATE", "ORG", "LAW", "EVENT", "QUANTITY"]
                   __proto__: Object
                   1:
                   key: "part_of_speech"
                   type: "discrete"
                   range: (15) ["ADV", "NOUN", "ADP", "PUNCT", "PROPN", "DET", "SYM", "INTJ", "PART", "PRON", "NUM", "X", "CONJ", "ADJ", "VERB"]
                   __proto__: Object
                   length: 2
                   __proto__: Array(0)
                   */

                  this.eventHandler.trigger(LSTMController.events.projectsMetaAvailable, {});
                  this.requestContext({});

              })


        } else {
            this.eventHandler.trigger(LSTMController.events.wrongParameters, params);
        }
    }

    _setDefaults(params) {
        const sd = (att, def) => params.set(att, params.get(att) || def); //The set() method adds or updates an element with a specified key and a value to a Map object.
        sd('left', 3);
        sd('right', 20);
        sd('dims', ['states', 'words']);
        sd('activation', 0.3);
        sd('cw', 30);
        sd('meta', []);
        sd('pos', 100);

    }

    requestContext({params = {}, persist = true, keepSelectedCells = true}) {
        /**
         * function that gets specific data such as word_ids and words 请求到的数据具体到某些词和词的ID，可以直接用来可视化
         */
        const parMap = Util.objectMap(params);
        const payload = new Map();
        const parameterNames =
          ['project', 'pos', 'source', 'left', 'right', 'activation'];

        parameterNames.forEach(pName =>
          payload.set(pName, (parMap.get(pName) || this.params.get(pName))));

        if (persist) {
            parameterNames.forEach(pName => {
                if (parMap.has(pName)) this.params.set(pName, parMap.get(pName))
            });
            this.updateURLparams();
        }

        payload.set('dims', [...(this.visibleMeta.map(d => 'meta_' + d)), 'states', 'words']);


        const fillRight = Math.ceil((this.windowSize.width - 60) / this.cellWidth) - this.params.get('left');
        payload.set('right', fillRight);
        /** example payload: payload就是把url 中params 的map ，通过发送键值对，得到HTTP 相应，获取到对应参数的数据
         * Map(7) {"project" => "05childbook", "pos" => 100, "source" => "states::output1", "left" => 3, "right" => 10, …}
         [[Entries]]
         0: {"project" => "05childbook"}
         1: {"pos" => 100}
         2: {"source" => "states::output1"}
         3: {"left" => 3}
         4: {"right" => 10}
         5: {"activation" => 0.3}
         6: {"dims" => Array(2)}
         key: "dims"
         value: Array(2)
         0: "states"
         1: "words"
         length: 2
         __proto__: Array(0)
         size: 7
         __proto__: Map
         */
        Network.ajax_request(this.apiURL + '/context')
          .get(payload)
          .then(d => {
              this.context = JSON.parse(d);
              /**
               * example this.context:
               * request:
               activation: 0.3
               dims: (2) ["states", "words"]
               left: 3
               pos: [100]
               project: "05childbook"
               right: 10
               source: "states::output1"
               transform: "tanh"
               __proto__: Object
               results:
               cells: []
               states: Array(1)
               0: {data: Array(200), left: 97, pos: 100, right: 110}
               length: 1
               __proto__: Array(0)
               words: Array(1)
               0:
               left: 97
               pos: 100
               right: 110
               word_ids: (14) [69, 62, 70, 32, 68, 15, 71, 62, 72, 41, 73, 74, 75, 76]
               words: (14) ["books", "she", "read", "and", "all", "the", "pictures", "she", "painted", ",", "would", "have", "been", "glad"]
               __proto__: Object
               length: 1
               __proto__: Array(0)
               __proto__: Object
               __proto__: Object
               */


              this.eventHandler.trigger(LSTMController.events.newContextAvailable, {keepSelectedCells});
          })

    }

    requestMatch({metaDims = [], mode = 'fast'}) {
        const matchPayload = new Map();
        const matchParameters =
          ['project', 'source', 'activation', 'left', 'right'];

        if (this.state.selectedCells && this.state.selectedCells.length > 0) {
            matchParameters.forEach(pName => matchPayload.set(pName, this.params.get(pName)));
            matchPayload.set('cells', this.state.selectedCells.join(','));
            matchPayload.set('constraints', this.params.get('wordBrushZero').join(','));
            matchPayload.set('dims', [...(metaDims.map(d => 'meta_' + d)), 'states', 'cell_count', 'words']);
            matchPayload.set('mode', mode);

            Network.ajax_request(this.apiURL + '/match')
              .get(matchPayload)
              .then(matchResponse => {
                  this.matchResult = JSON.parse(matchResponse);

                  console.log(this.matchResult, '\n-- matchResult --');
                  this.eventHandler.trigger(LSTMController.events.newMatchingResults, {});

              })
        }


    }


    requestWordSearch({searchTerm}) {
        const payload = new Map();

        payload.set('project', this.params.get('project'));
        payload.set('html', true);
        payload.set('q', searchTerm)

        Network.ajax_request(this.apiURL + '/search')
          .get(payload)
          .then(d => {
              this.wordSearchResult = JSON.parse(d);
              this.eventHandler.trigger(LSTMController.events.newWordSearchResults, this);
          })

    }


    get matchingWordMatrix() {
        return this.matchResult.results.positionDetail.words
    }

    get matchingCellCount() {
        return this.matchResult.results.positionDetail.cell_count
    }

    get matchingMetaDims() {
        const metaDims = Object.keys(this.matchResult.results.positionDetail)
          .filter(d => d.startsWith('meta_'));

        const res = {};
        metaDims.forEach(
          key => res[key.substring(5)] = this.matchResult.results.positionDetail[key]
        );

        return res;
    }

    get matchingLeftPadding() {
        return this.matchResult.request.left
    }

    get ctxLeftPadding() {
        return this.context.request.left
    }


    set wordBrush(range) {
        this.params.set('wordBrush', range);
        if (!range) this.params.set('wordBrushZero', null);
        else if (!this.params.get('wordBrushZero')) this.params.set('wordBrushZero', [1, 0]);
        this.updateURLparams();


    }

    get wordBrush() {
        return this.params.get('wordBrush');
    }

    set wordBrushZero(range) {
        this.params.set('wordBrushZero', range);
        this.updateURLparams();
    }

    get wordBrushZero() {
        return this.params.get('wordBrushZero');
    }


    get states() {
        return this.context.results.states[0];
    }

    get words() {
        return this.context.results.words[0]
    }

    get threshold() {
        return this.params.get('activation')
    }

    set threshold(value) {
        this.params.set('activation', value);
        this.updateURLparams();
    }

    get visibleMeta() {
        return this.params.get('meta')
    }

    set visibleMeta(meta) {
        this.params.set('meta', meta);
        this.updateURLparams();
    }


    get pos() {
        return this.params.get('pos');
    }

    set pos(p) {
        return this.params.set('pos', p);
    }

    get projectInfo() {
        return this.allProjectInfos.get(this.params.get('project')).info
    }

    get projectID() {
        return this.params.get('project');
    }

    get source() {
        return this.params.get('source') // eg. 'states::output1'
    }

    get availableSources() {
        return this.projectInfo.states.types.map(t => `${t.file}::${t.path}`); // ["states::states1", "states::output1"]
    }

    get projectMetas() {
        const meta = this.projectInfo.meta;

        return Object.keys(meta).map(key => ({
            key,
            type: meta[key].vis.type,
            range: meta[key].vis.range
        }))
    }

    get selectMetaDims() {
        const metaDims = Object.keys(this.context.results)
          .filter(d => d.startsWith('meta_'));

        const res = {};
        metaDims.forEach(
          key => res[key.substring(5)] = this.context.results[key]
        );

        return res;
    }


    get cellWidth() {
        return this.params.get('cw');
    }

    set cellWidth(w) {
        this.params.set('cw', w);
        this.updateURLparams();
    }

    get windowSize() {
        return {width: window.innerWidth - 20, height: window.innerHeight - 20}
    }

    cellSelection(recalc = false) {
        if (!('selectedCells' in this.state)) {
            this.state.selectedCells = this.params.get('sc') || [];
        }

        if (recalc) {
            if (this.wordBrush && this.wordBrushZero) {
                const threshold = this.threshold;
                const cellValues = this.states.data;

                const leftBound = this.wordBrush[0] - this.wordBrushZero[0];
                const rightBound = this.wordBrush[1] + this.wordBrushZero[1];

                const signature = Util.range(leftBound, rightBound)
                  .map(v => (v >= this.wordBrush[0] && v < this.wordBrush[1]) ? 1 : 0)
                  .join('')

                this.state.selectedCells = [];

                cellValues.forEach((cellVector, index) => {
                    const testSig = cellVector.slice(leftBound, rightBound)
                      .map(v => (v >= threshold) ? 1 : 0)
                      .join('');
                    if (testSig === signature) this.state.selectedCells.push(index);

                })


            } else {
                this.state.selectedCells = []
            }

        }

        if (this.state.selectedCells.length > 0) {
            this.params.set('sc', this.state.selectedCells)
        } else {
            this.params.delete('sc')
        }

        this.updateURLparams();

        return this.state.selectedCells;

    }

    sumCellValues(selectedCells) {
        const testMap = new Set(selectedCells);
        const threshold = this.threshold;
        const cellValues = this.states.data.filter((d, i) => testMap.has(i));


        const sumVector = cellValues[0].map(() => 0);
        cellValues.forEach(vector =>
          vector.forEach((v, i) =>
            sumVector[i] += (v >= threshold) ? 1 : 0))

        return sumVector;
    }


}

LSTMController;
