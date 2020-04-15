import argparse
import connexion
import numpy as np
import os
import yaml
from flask import send_from_directory, redirect

from lstmdata.data_handler import LSTMDataHandler
import lstmdata.read_index as ri

__author__ = 'Hendrik Strobelt'

CONFIG_FILE_NAME = 'lstm.yml'
data_handlers = {}
index_map = {}

app = connexion.App(__name__, debug=True)


def get_context(**request):
    """
    This function responds to a request for /api/v2/context
    :param request: key-value pairs of query parameters in url
    sample request: {
    "activation": 0.3,
    "cells": [
      2
    ],
    "dims": [
      "states",
      "words"
    ],
    "left": 3,
    "pos": [
      12
    ],
    "project": "parens",
    "right": 3,
    "source": "states::states1",
    "transform": "tanh"
  }
    :return:
    """
    project = request['project'] # project: 'parens'
    if project not in data_handlers:
        return 'No such project', 404
    else:
        dh = data_handlers[project]  # dh type: LSTMDatahandler object

        # check if source is exists
        if not dh.is_valid_source(request['source']):
            return 'No valid source. Valid are: ' + ' -- '.join(dh.valid_sources()), 404

        # cell selection by bitmask vs. cell array
        cells = []
        if 'bitmask' in request:
            cells = np.where(np.fromstring(request['bitmask'], dtype=np.uint8) > 48)[0].tolist()
        elif 'cells' in request:
            cells = request['cells'] # cells: [2]

        res = dh.get_dimensions(
            pos_array=request['pos'],
            source=request['source'],
            left=request['left'],
            right=request['right'],
            dimensions=request['dims'],
            data_transform=request['transform'],
            cells=cells,
            activation_threshold=request['activation']
        )
        # sample res:
        # {'states': [{'pos': 12,
        #    'left': 9,
        #    'right': 15,
        #    'data': [[-0.74336,
        #      -0.74502,
        #      -0.49196,
        #      -0.7894,
        #      -0.74757,
        #      -0.51531,
        #      -0.57777]]}],
        #  'words': [{'pos': 12,
        #    'word_ids': [4, 4, 5, 6, 4, 5, 7],
        #    'words': ['0', '0', '(', ')', '0', '(', '1'],
        #    'left': 9,
        #    'right': 15}]}
        res['cells'] = cells # add cells values to res dict

        return {'request': request, 'results': res}
    # sample return value:
    # {'request': {'activation': 0.3,
    #              'cells': [2],
    #              'dims': ['states', 'words'],
    #              'left': 3,
    #              'pos': [12],
    #              'project': 'parens',
    #              'right': 3,
    #              'source': 'states::states1',
    #              'transform': 'tanh'},
    #  'results': {'states': [{'pos': 12,
    #                          'left': 9,
    #                          'right': 15,
    #                          'data': [[-0.74336,
    #                                    -0.74502,
    #                                    -0.49196,
    #                                    -0.7894,
    #                                    -0.74757,
    #                                    -0.51531,
    #                                    -0.57777]]}],
    #              'words': [{'pos': 12,
    #                         'word_ids': [4, 4, 5, 6, 4, 5, 7],
    #                         'words': ['0', '0', '(', ')', '0', '(', '1'],
    #                         'left': 9,
    #                         'right': 15}],
    #              'cells': [2]}}
def get_info():
    """
    funciton that gets each project and all configurations
    :return:
    """
    res = []
    for key, project in data_handlers.iteritems():
        # print key
        res.append({
            'project': key,
            'info': project.config
        })
    return sorted(res, key=lambda x: x['project'])
"""
sample return value: [{'project': '05childbook',
  'info': {'name': "Word Model (Children's Books)",
   'description': "A 1x200 LSTM language model trained on the Gutenberg Children's Book corpus.",
   'files': {'states': 'states.h5',
    'train': 'train.h5',
    'words': 'words.dict',
    'pos': 'pos.h5',
    'pos_dict': 'pos.dict',
    'ner': 'ner.h5',
    'ner_dict': 'ner.dict'},
   'word_sequence': {'file': 'train',
    'path': 'words',
    'dict_file': 'words',
    'size': [1271912],
    'dict_size': 21688},
   'states': {'file': 'states',
    'types': [{'type': 'cell',
      'layer': 1,
      'path': 'states1',
      'unsigned': False,
      'file': 'states',
      'transform': 'tanh',
      'size': [1271900, 200]},
     {'type': 'hidden',
      'layer': 1,
      'path': 'output1',
      'unsigned': False,
      'file': 'states',
      'transform': 'tanh',
      'size': [1271900, 200]}]},
   'meta': {'part_of_speech': {'file': 'pos',
     'path': 'pos',
     'dict': 'pos_dict',
     'vis': {'type': 'discrete',
      'range': dict_keys(['ADV', 'NOUN', 'NUM', 'ADP', 'PRON', 'PROPN', 'DET', 'SYM', 'INTJ', 'PART', 'PUNCT', 'VERB', 'X', 'CONJ', 'ADJ'])},
     'type': 'general',
     'index': 'self'},
    'named_entity': {'file': 'ner',
     'path': 'ner',
     'dict': 'ner_dict',
     'vis': {'type': 'discrete',
      'range': dict_keys(['ORDINAL', 'LOC', 'PRODUCT', 'NORP', 'WORK_OF_ART', 'LANGUAGE', 'GPE', 'MONEY', 'O', 'PERSON', 'CARDINAL', 'TIME', 'DATE', 'ORG', 'LAW', 'EVENT', 'QUANTITY'])},
     'type': 'general',
     'index': 'self'}},
   'word_embedding': {'size': [-1, -1]},
   'index': True,
   'index_dir': '/Users/jaywang/Documents/TTU_study/Fall2019/LSTMVis/data/05childbook/05childbook/indexdir',
   'etc': {'regex_search': False},
   'is_searchable': True}},
 {'project': 'parens',
  'info': {'name': 'parens 10k',
   'description': 'parens dataset 10k ONLY',
   'files': {'states': 'states.hdf5',
    'train': 'train.hdf5',
    'words': 'train.dict'},
   'word_sequence': {'file': 'train',
    'path': 'words',
    'dict_file': 'words',
    'size': [10001],
    'dict_size': 10},
   'states': {'file': 'states',
    'types': [{'type': 'state',
      'layer': 1,
      'path': 'states1',
      'file': 'states',
      'unsigned': False,
      'transform': 'tanh',
      'size': [10000, 200]},
     {'type': 'state',
      'layer': 2,
      'path': 'states2',
      'file': 'states',
      'unsigned': False,
      'transform': 'tanh',
      'size': [10000, 200]},
     {'type': 'output',
      'layer': 2,
      'path': 'output2',
      'file': 'states',
      'unsigned': False,
      'transform': 'tanh',
      'size': [10000, 200]}]},
   'word_embedding': {'size': [-1, -1]},
   'index': False,
   'meta': [],
   'etc': {'regex_search': False},
   'is_searchable': False}}]
"""



def search(**request):
    project = request['project']
    res = {}

    if project not in data_handlers:
        return 'No such project', 404

    else:
        # start search either using index or regex

        dh = data_handlers[project]
        if project in index_map:
            res = ri.query_index(request['q'], request['limit'], request['html'],
                                 dir=index_map[project])
        elif dh.config['etc']['regex_search']:
            res = dh.regex_search(request['q'], request['limit'], request['html'])

    return {'request': request, 'res': res}


def match(**request):
    project = request['project']
    res = {}

    if project not in data_handlers:
        return 'No such project', 404

    else:
        dh = data_handlers[project]  # type: LSTMDataHandler

        # check if source is exists
        if not dh.is_valid_source(request['source']):
            return 'No valid source', 404

        ranking, meta = dh.query_similar_activations(
            source=request['source'],
            cells=request['cells'],
            activation_threshold=request['activation'],
            data_transform=request['transform'],
            phrase_length=request['phrase_length'],
            add_histograms=True,
            query_mode=request['mode'],
            constrain_left=request['constraints'][0] > 0,
            constrain_right=request['constraints'][1] > 0
        )

        request_positions = map(lambda x: x['pos'], ranking)
        position_details = dh.get_dimensions(
            pos_array=request_positions,
            source=request['source'],
            left=request['left'],
            right=request['right'],
            cells=request['cells'],
            dimensions=request['dims'],
            data_transform=request['transform'],
            activation_threshold=request['activation']
        )

        res = {
            'rankingDetail': ranking,
            'positionDetail': position_details,
            'fuzzyLengthHistogram': meta['fuzzy_length_histogram'].tolist(),
            'strictLengthHistogram': meta['strict_length_histogram'].tolist()
        }

        return {'request': request, 'results': res}


@app.route('/client/<path:path>') # Route: a mapping of URLs to Python functions
def send_static(path): # View function: function that handles application URL
    """ serves all files from ./client/ to ``/client/<path:path>``

    :param path: path from api call
    """
    return send_from_directory('client/', path)

@app.route('/')
def redirect_home():
    return redirect('/client/index.html', code=302)


def create_data_handlers(directory):
    """
    searches for CONFIG_FILE_NAME in all subdirectories of directory
    and creates data handlers for all of them

    :param directory: scan directory
    :return: null
    """
    project_dirs = []
    # os.walk: iterate all the files and folders under a top directory, returns a 3-element tuple of (root, dirs, files)
    # root: current directory, dirs: a list of sub directories, files: a list of sub files
    for root, dirs, files in os.walk(directory):
        if CONFIG_FILE_NAME in files:
            project_dirs.append(os.path.abspath(root)) # os.path.abspath(path) returns the absolute path of 'lstm.yml'

    i = 0
    for p_dir in project_dirs:
        with open(os.path.join(p_dir, CONFIG_FILE_NAME), 'r') as yf:
            config = yaml.load(yf) # config now is a dictionary
            dh_id = os.path.split(p_dir)[1] # '05childbook'
            data_handlers[dh_id] = LSTMDataHandler(directory=p_dir, config=config)
            if data_handlers[dh_id].config['index']:
                index_map[dh_id] = data_handlers[dh_id].config['index_dir']   # {'05childbook': '/Users/jaywang/Documents/TTU_study/Fall2019/LSTMVis/data/05childbook/05childbook/indexdir'}
        i += 1
        # data_handlers:
        # {'05childbook': <__main__.LSTMDataHandler at 0x121f56c90>,
        #  'parens': <__main__.LSTMDataHandler at 0x121c632d0>}


app.add_api('lstm_server.yaml')

parser = argparse.ArgumentParser()
parser.add_argument("--nodebug", default=False)
parser.add_argument("--port", default="8080")
parser.add_argument("--nocache", default=False)
parser.add_argument("-dir", type=str, default=os.path.abspath('data'))

if __name__ == '__main__':
    args = parser.parse_args()
    app.run(port=int(args.port), debug=not args.nodebug, host="0.0.0.0")
else:
    args, _ = parser.parse_known_args()
    create_data_handlers(args.dir)
