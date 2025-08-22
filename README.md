<p align="center">
  <img src="/site/content/en/images/dataup-readme-gif.gif" alt="CVAT-DATAUP Platform" width="100%" max-width="800px">
</p>

# CVAT-DATAUP: Enhanced Computer Vision Annotation Platform

**CVAT-DATAUP** is an enhanced version of the popular open-source Computer Vision Annotation Tool (CVAT), featuring new capabilities and an improved user experience while maintaining full compatibility with existing CVAT instances. It provides a modern interface, advanced annotation tools, an integration with AI agents. Beyond annotation, the next open-source release of CVAT-DATAUP will introduce powerful data-driven capabilities such as automated dataset processing, dataset versioning, quality assurance pipelines, model-in-the-loop evaluation, and agent benchmarking. These enhancements elevate CVAT-DATAUP from a traditional labeling platform into a comprehensive environment for managing the full lifecycle of data-centric AI development — from curation and annotation to validation, deployment feedback, and continuous improvement.


## 🚀 What Makes CVAT-DATAUP Special

- **🤖 Agent Support**: Leverage intelligent agents for data processing and automation 🔜
- **⚡ Pipeline Architecture**: Design customizable pipelines for scalable data processing 🔜
- **✨ Enhanced Annotation Experience**: Improved UI/UX for faster and more intuitive annotation 
- **🔄 Full CVAT Compatibility**: Seamlessly work with existing CVAT projects and data
- **📊 Advanced Analytics**: Better insights into annotation progress and quality

## Built on CVAT Foundation

CVAT-DATAUP is based on the robust foundation of [CVAT](https://github.com/cvat-ai/cvat), the industry-standard annotation tool used by tens of thousands of users and companies worldwide. We've enhanced it with cutting-edge features while preserving all the reliability and functionality that makes CVAT great.

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


### CVAT Resources (Fully Compatible)

- [CVAT Manual](https://docs.cvat.ai/docs/manual/)
- [XML annotation format](https://docs.cvat.ai/docs/manual/advanced/xml_format/)
- [Datumaro dataset framework](https://github.com/cvat-ai/datumaro/blob/develop/README.md)
- [CVAT FAQ](https://docs.cvat.ai/docs/faq/)

## 🤖 Agents 🔜

CVAT-DATAUP introduces intelligent agents that extend beyond traditional annotation workflows:

- 🔗**Seamless Integration**: Connect with public AI agents (visible to everyone) or private/self-hosted agents restricted to your organization.
- 🤖 **Auto-Annotation**: Use agents to accelerate annotation by automatically labeling data based on learned patterns.
✅ **Quality Assurance**: Employ agents to validate and score annotations, improving dataset reliability.
- ⚡ **Data Processing Pipelines**: Incorporate agents into end-to-end pipelines for transformation, filtering, or enrichment tasks.
- 🛠️ **Custom Agent Development**: Build and deploy domain-specific agents tailored to your workflows.

*Note: Agent functionality is currently in development and will be available in future releases.*

## ⚡ Streamlined Data Workflows with Customizable Pipelines 🔜

Pipelines in **CVAT-DATAUP** are built by chaining modular steps — these steps can be **AI agents**, **data processing tasks**, or **integrations with external systems** (e.g., databases, storage, or model APIs). This flexible design makes it possible to automate complex workflows, from raw data ingestion to final dataset export.

- **🔧 Pre-processing Pipelines**: Data cleaning, preparation, and augmentation before annotation  
- **🖊️ Annotation Pipelines**: Structured annotation flows that ensure consistency and efficiency  
- **✅ Post-processing Pipelines**: Automated validation, quality control, and export of processed data  
- **⚡ Custom Pipeline Builder**: A visual interface for designing and deploying pipelines tailored to your needs  

> ⚠️ *Pipeline functionality is in active development and will be available in future releases.*


## 🔄 Full CVAT Compatibility

**CVAT-DATAUP** is fully compatible with existing **CVAT** deployments, ensuring a smooth transition without breaking workflows:

- **📦 Project Migration**: Import and continue working with your existing CVAT projects  
- **🗂️ Data Format Support**: All annotation formats supported by CVAT remain fully compatible  
- **🔌 API Compatibility**: Existing CVAT-based integrations work out of the box  
- **📤 Export Compatibility**: Annotations can be exported in standard CVAT formats  

If you already have **CVAT** installed, migrating to **CVAT-DATAUP** is straightforward.  
In addition to applying the database migrations, run the following command inside your CVAT server container:

```bash
docker exec -it cvat_server bash -ic 'python3 ~/manage.py populate_dataup_uuids'
```


## Prebuilt Docker images 🐳

CVAT-DATAUP provides prebuilt Docker images for easy deployment:

- **cvat-dataup/server**: Enhanced backend with agent and pipeline support
- **cvat-dataup/ui**: Improved frontend with modern interface

All images are based on the proven CVAT architecture with additional enhancements.


## 📜 License

**CVAT-DATAUP** builds on top of [CVAT](https://github.com/opencv/cvat) and maintains the same licensing model.  
Unless otherwise noted, the code is released under the [MIT License](https://opensource.org/licenses/MIT).

- **serverless**: Code in this directory is also released under the MIT License.  
  However, it may download and use additional assets (e.g., source code, model architectures, weights).  
  These assets may be subject to different licenses, including non-commercial ones.  
  It is your responsibility to review and comply with the licenses of these assets before use.

- **FFmpeg**: This project uses LGPL-licensed libraries from the [FFmpeg](https://www.ffmpeg.org) project.  
  The configuration and compilation steps for FFmpeg are detailed in the [Dockerfile](Dockerfile).  

FFmpeg itself is open-source and licensed under LGPL and GPL. See [FFmpeg Legal](https://www.ffmpeg.org/legal.html) for more details.  
You are solely responsible for ensuring that your use of FFmpeg complies with the appropriate licenses. Neither CVAT nor CVAT-DATAUP authors are responsible for obtaining additional licenses or covering any related fees.  


## Contact us

**CVAT-DATAUP Support:**

[GitHub Issues](https://github.com/dataup-io/cvat-dataup/issues) for feature requests, bug reports, and technical support.
Please include detailed steps to reproduce any issues.

**CVAT Community Resources (Fully Compatible):**

Since CVAT-DATAUP is fully compatible with CVAT, you can also leverage the existing CVAT community:

- [CVAT Gitter](https://gitter.im/opencv-cvat/public) for general annotation questions
- [CVAT Discord](https://discord.gg/S6sRHhuQ7K) for community discussions
- [#cvat](https://stackoverflow.com/search?q=%23cvat) tag on StackOverflow for technical questions
