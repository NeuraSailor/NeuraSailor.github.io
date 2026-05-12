本质上通过描述**部件**与链接连接部件的**关节**，构建机器人
### 示例代码  
```xml
(其后缀是.urdf ，不是xml,用xml只是为了颜色好看)
<?xml version="1.0"?>
<robot name="first_robot">
    <!-- 机器人的身体部分 -->
    <link name="base-link">
        <!-- 部件外观描述 -->
        <visual>
            <!-- 沿自己几何中心的偏移旋转量 -->
            <origin xyz="0.0 0.0 0.0" rpy="0.0 0.0 0.0"/>
            <!-- 几何形状 -->
            <geometry>
                <!-- 圆柱体 半径 高度 -->
                <cylinder radius="0.10" length="0.12"/>
            </geometry>
            <!-- 材质颜色 -->
            <material name="white">
                <!-- 红绿蓝透明度 -->
                <color rgba="1.0 1.0 1.0 0.5"/>
            </material>
        </visual>
    </link>

    <!-- 机器人的IMU部件，惯性测量传感器 -->
    <link name="imu-link">
        <visual>
            <origin xyz="0.0 0.0 0.06" rpy="0.0 0.0 0.0"/>
            <geometry>
                <box size="0.02 0.02 0.02"/>
            </geometry>
            <material name="blue">
                <color rgba="0.0 0.0 0.0 0.5"/>
            </material>
        </visual>
    </link>

    <!-- 机器人的关节，用于组合部件 -->
    <joint name="imu_joint" type="fixed">
        <!-- 关节父部件 -->
        <parent link="base-link"/>
        <!-- 关节子部件 -->
        <child link="imu-link"/>
        <!-- 固定位置 -->
        <origin xyz="0.0 0.0 0.03" rpy="0.0 0.0 0.0"/>
    </joint>

</robot>
```
### 生成关系图  
命令：
`urdf_to_graphviz first_robot.urdf`  
生成 PDF 如图：  
![|175](https://gitee.com/zjuwzy/obsidian_picture/raw/master/20250911212218830.png)
