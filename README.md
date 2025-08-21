<p align="center">
  <img src="/site/content/en/images/dataup-readme-gif.gif" alt="CVAT-DATAUP Platform" width="100%" max-width="800px">
</p>

# CVAT-DATAUP: Enhanced Computer Vision Annotation Platform

<!-- [![CI][ci-img]][ci-url]
[![Gitter chat][gitter-img]][gitter-url]
[![Discord][discord-img]][discord-url]
[![Coverage Status][coverage-img]][coverage-url]
[![server pulls][docker-server-pulls-img]][docker-server-image-url]
[![ui pulls][docker-ui-pulls-img]][docker-ui-image-url]
[![DOI][doi-img]][doi-url]
[![Status][status-img]][status-url] -->

**CVAT-DATAUP** is an enhanced version of the popular open-source Computer Vision Annotation Tool (CVAT), featuring new capabilities and an improved user experience while maintaining full compatibility with existing CVAT instances.

## 🚀 What Makes CVAT-DATAUP Special

- **🤖 Agent Support**: Integrated AI agents for intelligent annotation assistance
- **⚡ Pipeline Architecture**: Streamlined workflows with customizable annotation pipelines
- **✨ Enhanced Annotation Experience**: Improved UI/UX for faster and more intuitive annotation
- **🔄 Full CVAT Compatibility**: Seamlessly work with existing CVAT projects and data
- **📊 Advanced Analytics**: Better insights into annotation progress and quality

## Built on CVAT Foundation

CVAT-DATAUP is based on the robust foundation of [CVAT](https://github.com/cvat-ai/cvat), the industry-standard annotation tool used by tens of thousands of users and companies worldwide. We've enhanced it with cutting-edge features while preserving all the reliability and functionality that makes CVAT great.

### Key Enhancements Over Standard CVAT:

- **Intelligent Agents**: AI-powered annotation assistants that learn from your workflow
- **Pipeline Management**: Create, manage, and execute complex annotation workflows
- **Improved Performance**: Optimized for faster loading and smoother annotation experience
- **Modern Interface**: Updated UI with better accessibility and user experience

## Quick start ⚡

### Installation

CVAT-DATAUP can be deployed using Docker Compose for easy setup:

```bash
# Clone the repository
git clone https://github.com/your-org/cvat-dataup.git
cd cvat-dataup

# Start the application
docker-compose up -d
```

The application will be available at `http://localhost:8080`

### Documentation & Resources

- [Installation guide](#installation)
- [Agent Configuration](#agents)
- [Pipeline Setup](#pipelines)
- [Server API](#api)
- [Python SDK](#sdk)
- [Command line tool](#cli)
- [CVAT Compatibility Guide](#cvat-compatibility)
- [Migration from CVAT](#migration)

### CVAT Resources (Fully Compatible)

- [CVAT Manual](https://docs.cvat.ai/docs/manual/)
- [XML annotation format](https://docs.cvat.ai/docs/manual/advanced/xml_format/)
- [Datumaro dataset framework](https://github.com/cvat-ai/datumaro/blob/develop/README.md)
- [CVAT FAQ](https://docs.cvat.ai/docs/faq/)

## 🤖 Agents

CVAT-DATAUP introduces intelligent agents that enhance the annotation workflow:

- **Auto-Annotation Agents**: AI-powered agents that can automatically annotate objects based on learned patterns
- **Quality Control Agents**: Automated quality assessment and validation of annotations
- **Workflow Optimization Agents**: Smart agents that optimize annotation pipelines for efficiency
- **Custom Agent Development**: Framework for developing domain-specific annotation agents

*Note: Agent functionality is currently in development and will be available in future releases.*

## ⚡ Pipelines

Streamlined annotation workflows with customizable pipelines:

- **Pre-processing Pipelines**: Automated data preparation and augmentation
- **Annotation Pipelines**: Structured workflows for consistent annotation processes
- **Post-processing Pipelines**: Automated validation, export, and quality control
- **Custom Pipeline Builder**: Visual interface for creating custom annotation workflows

*Note: Pipeline functionality is currently in development and will be available in future releases.*

## 🔄 CVAT Compatibility

CVAT-DATAUP maintains full compatibility with CVAT:

- **Project Migration**: Seamlessly import existing CVAT projects
- **Data Format Support**: All CVAT annotation formats are supported
- **API Compatibility**: Existing CVAT integrations work without modification
- **Export Compatibility**: Export annotations in standard CVAT formats

## Partners & Ecosystem ❤️

CVAT-DATAUP builds upon the strong CVAT ecosystem and is compatible with existing CVAT integrations:

- **CVAT Ecosystem**: Full compatibility with existing CVAT tools and integrations
- **FiftyOne**: Seamless integration with FiftyOne for dataset curation and model analysis
- **Datumaro**: Enhanced support for the Datumaro dataset framework
- **Custom Integrations**: Easy integration with existing computer vision pipelines

## Public datasets

[ATLANTIS](https://github.com/smhassanerfani/atlantis), an open-source dataset for semantic segmentation
of waterbody images, developed by [iWERS](http://ce.sc.edu/iwers/) group in the
Department of Civil and Environmental Engineering at the University of South Carolina is using CVAT.

For developing a semantic segmentation dataset using CVAT, see:

- [ATLANTIS published article](https://www.sciencedirect.com/science/article/pii/S1364815222000391)
- [ATLANTIS Development Kit](https://github.com/smhassanerfani/atlantis/tree/master/adk)
- [ATLANTIS annotation tutorial videos](https://www.youtube.com/playlist?list=PLIfLGY-zZChS5trt7Lc3MfNhab7OWl2BR).

## 🐳 Self-Hosted Deployment

CVAT-DATAUP is designed for self-hosted deployment, giving you full control over your annotation infrastructure:

- **Complete Data Control**: Keep your sensitive data on your own infrastructure
- **Unlimited Usage**: No restrictions on tasks, data size, or users
- **Custom Configuration**: Tailor the platform to your specific needs
- **Enhanced Security**: Deploy behind your firewall with custom security policies
- **Agent & Pipeline Support**: Access to all advanced features including agents and pipelines

## Prebuilt Docker images 🐳

CVAT-DATAUP provides prebuilt Docker images for easy deployment:

- **cvat-dataup/server**: Enhanced backend with agent and pipeline support
- **cvat-dataup/ui**: Improved frontend with modern interface
- **cvat-dataup/agents**: AI agent runtime environment
- **cvat-dataup/pipelines**: Pipeline execution engine

All images are based on the proven CVAT architecture with additional enhancements.

## Screencasts 🎦

Here are some screencasts showing how to use CVAT.

<!--lint disable maximum-line-length-->

[Computer Vision Annotation Course](https://www.youtube.com/playlist?list=PL0to7Ng4PuuYQT4eXlHb_oIlq_RPeuasN):
we introduce our course series designed to help you annotate data faster and better
using CVAT. This course is about CVAT deployment and integrations, it includes
presentations and covers the following topics:

- **Speeding up your data annotation process: introduction to CVAT and Datumaro**.
  What problems do CVAT and Datumaro solve, and how they can speed up your model
  training process. Some resources you can use to learn more about how to use them.
- **Deployment and use CVAT**. Use the app online at [app.cvat.ai](https://app.cvat.ai).
  A local deployment. A containerized local deployment with Docker Compose (for regular use),
  and a local cluster deployment with Kubernetes (for enterprise users). A 2-minute
  tour of the interface, a breakdown of CVAT’s internals, and a demonstration of how
  to deploy CVAT using Docker Compose.

[Product tour](https://www.youtube.com/playlist?list=PL0to7Ng4Puua37NJVMIShl_pzqJTigFzg): in this course, we show how to use CVAT, and help to get familiar with CVAT functionality and interfaces. This course does not cover integrations and is dedicated solely to CVAT. It covers the following topics:

- **Pipeline**. In this video, we show how to use [app.cvat.ai](https://app.cvat.ai): how to sign up, upload your data, annotate it, and download it.

<!--lint enable maximum-line-length-->

For feedback, please see [Contact us](#contact-us)

## API

- [Documentation](https://docs.cvat.ai/docs/api_sdk/api/)

## SDK

- Install with `pip install cvat-sdk`
- [PyPI package homepage](https://pypi.org/project/cvat-sdk/)
- [Documentation](https://docs.cvat.ai/docs/api_sdk/sdk/)

## CLI

- Install with `pip install cvat-cli`
- [PyPI package homepage](https://pypi.org/project/cvat-cli/)
- [Documentation](https://docs.cvat.ai/docs/api_sdk/cli/)

## Supported annotation formats

CVAT supports multiple annotation formats. You can select the format
after clicking the **Upload annotation** and **Dump annotation** buttons.
[Datumaro](https://github.com/cvat-ai/datumaro) dataset framework allows
additional dataset transformations with its command line tool and Python library.

For more information about the supported formats, see:
[Annotation Formats](https://docs.cvat.ai/docs/manual/advanced/formats/).

<!--lint disable maximum-line-length-->

| Annotation format                                                                                | Import | Export |
| ------------------------------------------------------------------------------------------------ | ------ | ------ |
| [CVAT for images](https://docs.cvat.ai/docs/manual/advanced/xml_format/#annotation)              | ✔️     | ✔️     |
| [CVAT for a video](https://docs.cvat.ai/docs/manual/advanced/xml_format/#interpolation)          | ✔️     | ✔️     |
| [Datumaro](https://github.com/cvat-ai/datumaro)                                                  | ✔️     | ✔️     |
| [PASCAL VOC](http://host.robots.ox.ac.uk/pascal/VOC/)                                            | ✔️     | ✔️     |
| Segmentation masks from [PASCAL VOC](http://host.robots.ox.ac.uk/pascal/VOC/)                    | ✔️     | ✔️     |
| [YOLO](https://pjreddie.com/darknet/yolo/)                                                       | ✔️     | ✔️     |
| [MS COCO Object Detection](http://cocodataset.org/#format-data)                                  | ✔️     | ✔️     |
| [MS COCO Keypoints Detection](http://cocodataset.org/#format-data)                               | ✔️     | ✔️     |
| [MOT](https://motchallenge.net/)                                                                 | ✔️     | ✔️     |
| [MOTS PNG](https://www.vision.rwth-aachen.de/page/mots)                                          | ✔️     | ✔️     |
| [LabelMe 3.0](http://labelme.csail.mit.edu/Release3.0)                                           | ✔️     | ✔️     |
| [ImageNet](http://www.image-net.org)                                                             | ✔️     | ✔️     |
| [CamVid](http://mi.eng.cam.ac.uk/research/projects/VideoRec/CamVid/)                             | ✔️     | ✔️     |
| [WIDER Face](http://shuoyang1213.me/WIDERFACE/)                                                  | ✔️     | ✔️     |
| [VGGFace2](https://github.com/ox-vgg/vgg_face2)                                                  | ✔️     | ✔️     |
| [Market-1501](https://www.aitribune.com/dataset/2018051063)                                      | ✔️     | ✔️     |
| [ICDAR13/15](https://rrc.cvc.uab.es/?ch=2)                                                       | ✔️     | ✔️     |
| [Open Images V6](https://storage.googleapis.com/openimages/web/index.html)                       | ✔️     | ✔️     |
| [Cityscapes](https://www.cityscapes-dataset.com/login/)                                          | ✔️     | ✔️     |
| [KITTI](http://www.cvlibs.net/datasets/kitti/)                                                   | ✔️     | ✔️     |
| [Kitti Raw Format](https://www.cvlibs.net/datasets/kitti/raw_data.php)                           | ✔️     | ✔️     |
| [LFW](http://vis-www.cs.umass.edu/lfw/)                                                          | ✔️     | ✔️     |
| [Supervisely Point Cloud Format](https://docs.supervise.ly/data-organization/00_ann_format_navi) | ✔️     | ✔️     |
| [Ultralytics YOLO Detection](https://docs.ultralytics.com/datasets/detect/)                      | ✔️     | ✔️     |
| [Ultralytics YOLO Oriented Bounding Boxes](https://docs.ultralytics.com/datasets/obb/)           | ✔️     | ✔️     |
| [Ultralytics YOLO Segmentation](https://docs.ultralytics.com/datasets/segment/)                  | ✔️     | ✔️     |
| [Ultralytics YOLO Pose](https://docs.ultralytics.com/datasets/pose/)                             | ✔️     | ✔️     |
| [Ultralytics YOLO Classification](https://docs.ultralytics.com/datasets/classify/)               | ✔️     | ✔️     |

<!--lint enable maximum-line-length-->

## Deep learning serverless functions for automatic labeling

CVAT supports automatic labeling. It can speed up the annotation process
up to 10x. Here is a list of the algorithms we support, and the platforms they can be run on:

<!--lint disable maximum-line-length-->

| Name                                                                                                    | Type       | Framework  | CPU | GPU |
| ------------------------------------------------------------------------------------------------------- | ---------- | ---------- | --- | --- |
| [Segment Anything](/serverless/pytorch/facebookresearch/sam/nuclio/)                                    | interactor | PyTorch    | ✔️  | ✔️  |
| [Deep Extreme Cut](/serverless/openvino/dextr/nuclio)                                                   | interactor | OpenVINO   | ✔️  |     |
| [Faster RCNN](/serverless/openvino/omz/public/faster_rcnn_inception_resnet_v2_atrous_coco/nuclio)       | detector   | OpenVINO   | ✔️  |     |
| [Mask RCNN](/serverless/openvino/omz/public/mask_rcnn_inception_resnet_v2_atrous_coco/nuclio)           | detector   | OpenVINO   | ✔️  |     |
| [YOLO v3](/serverless/openvino/omz/public/yolo-v3-tf/nuclio)                                            | detector   | OpenVINO   | ✔️  |     |
| [YOLO v7](/serverless/onnx/WongKinYiu/yolov7/nuclio)                                                    | detector   | ONNX       | ✔️  | ✔️  |
| [Object reidentification](/serverless/openvino/omz/intel/person-reidentification-retail-0277/nuclio)    | reid       | OpenVINO   | ✔️  |     |
| [Semantic segmentation for ADAS](/serverless/openvino/omz/intel/semantic-segmentation-adas-0001/nuclio) | detector   | OpenVINO   | ✔️  |     |
| [Text detection v4](/serverless/openvino/omz/intel/text-detection-0004/nuclio)                          | detector   | OpenVINO   | ✔️  |     |
| [SiamMask](/serverless/pytorch/foolwood/siammask/nuclio)                                                | tracker    | PyTorch    | ✔️  | ✔️  |
| [TransT](/serverless/pytorch/dschoerk/transt/nuclio)                                                    | tracker    | PyTorch    | ✔️  | ✔️  |
| [f-BRS](/serverless/pytorch/saic-vul/fbrs/nuclio)                                                       | interactor | PyTorch    | ✔️  |     |
| [HRNet](/serverless/pytorch/saic-vul/hrnet/nuclio)                                                      | interactor | PyTorch    |     | ✔️  |
| [Inside-Outside Guidance](/serverless/pytorch/shiyinzhang/iog/nuclio)                                   | interactor | PyTorch    | ✔️  |     |
| [Faster RCNN](/serverless/tensorflow/faster_rcnn_inception_v2_coco/nuclio)                              | detector   | TensorFlow | ✔️  | ✔️  |
| [RetinaNet](serverless/pytorch/facebookresearch/detectron2/retinanet_r101/nuclio)                       | detector   | PyTorch    | ✔️  | ✔️  |
| [Face Detection](/serverless/openvino/omz/intel/face-detection-0205/nuclio)                             | detector   | OpenVINO   | ✔️  |     |

<!--lint enable maximum-line-length-->

## License

The code is released under the [MIT License](https://opensource.org/licenses/MIT).

The code contained within the `/serverless` directory is released under the **MIT License**.
However, it may download and utilize various assets, such as source code, architectures, and weights, among others.
These assets may be distributed under different licenses, including non-commercial licenses.
It is your responsibility to ensure compliance with the terms of these licenses before using the assets.

This software uses LGPL-licensed libraries from the [FFmpeg](https://www.ffmpeg.org) project.
The exact steps on how FFmpeg was configured and compiled can be found in the [Dockerfile](Dockerfile).

FFmpeg is an open-source framework licensed under LGPL and GPL.
See [https://www.ffmpeg.org/legal.html](https://www.ffmpeg.org/legal.html). You are solely responsible
for determining if your use of FFmpeg requires any
additional licenses. CVAT.ai Corporation is not responsible for obtaining any
such licenses, nor liable for any licensing fees due in
connection with your use of FFmpeg.

## Contact us

**CVAT-DATAUP Support:**

[GitHub Issues](https://github.com/your-org/cvat-dataup/issues) for feature requests, bug reports, and technical support.
Please include detailed steps to reproduce any issues.

**CVAT Community Resources (Fully Compatible):**

Since CVAT-DATAUP is fully compatible with CVAT, you can also leverage the existing CVAT community:

- [CVAT Gitter](https://gitter.im/opencv-cvat/public) for general annotation questions
- [CVAT Discord](https://discord.gg/S6sRHhuQ7K) for community discussions
- [#cvat](https://stackoverflow.com/search?q=%23cvat) tag on StackOverflow for technical questions

**Migration & Enterprise Support:**

For help migrating from CVAT or enterprise deployment support, please open a GitHub issue with the "support" label.

## Links

**CVAT-DATAUP Resources:**

- [GitHub Repository](https://github.com/your-org/cvat-dataup) - Source code and documentation
- [Migration Guide](#migration) - How to migrate from CVAT to CVAT-DATAUP
- [Agent Development Guide](#agents) - Building custom annotation agents
- [Pipeline Configuration](#pipelines) - Setting up annotation workflows

**CVAT Foundation Resources:**

- [Original CVAT Repository](https://github.com/cvat-ai/cvat) - The foundation of CVAT-DATAUP
- [How to Use CVAT (Roboflow guide)](https://blog.roboflow.com/cvat/) - Applicable to CVAT-DATAUP
- [CVAT Documentation](https://docs.cvat.ai/) - Core functionality documentation
- [Intel AI blog: CVAT Introduction](https://www.intel.ai/introducing-cvat) - Background on CVAT

---

**Note**: CVAT-DATAUP is an enhanced version of CVAT with additional features. It maintains full compatibility with CVAT while adding agents, pipelines, and improved user experience. All CVAT tutorials and guides are applicable to CVAT-DATAUP.

  <!-- Badges -->

[docker-server-pulls-img]: https://img.shields.io/docker/pulls/cvat/server.svg?style=flat-square&label=server%20pulls
[docker-server-image-url]: https://hub.docker.com/r/cvat/server
[docker-ui-pulls-img]: https://img.shields.io/docker/pulls/cvat/ui.svg?style=flat-square&label=UI%20pulls
[docker-ui-image-url]: https://hub.docker.com/r/cvat/ui
[ci-img]: https://github.com/cvat-ai/cvat/actions/workflows/main.yml/badge.svg?branch=develop
[ci-url]: https://github.com/cvat-ai/cvat/actions
[gitter-img]: https://img.shields.io/gitter/room/opencv-cvat/public?style=flat
[gitter-url]: https://gitter.im/opencv-cvat/public
[coverage-img]: https://codecov.io/github/cvat-ai/cvat/branch/develop/graph/badge.svg
[coverage-url]: https://codecov.io/github/cvat-ai/cvat
[doi-img]: https://zenodo.org/badge/139156354.svg
[doi-url]: https://zenodo.org/badge/latestdoi/139156354
[discord-img]: https://img.shields.io/discord/1000789942802337834?label=discord
[discord-url]: https://discord.gg/fNR3eXfk6C
[status-img]: https://uptime.betterstack.com/status-badges/v2/monitor/1yl3h.svg
[status-url]: https://status.cvat.ai
